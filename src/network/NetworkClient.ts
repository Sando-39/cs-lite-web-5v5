import { Client, type Room } from "@colyseus/sdk";
import { ROOM_NAME } from "../../shared/constants";
import type { ClientPlayerSnapshot, FireResultMessage, MoveMessage, TargetSnapshot } from "../../shared/types";

export type EndpointInput = {
  isDev: boolean;
  protocol: string;
  host: string;
};

export type ConnectionStatus = "idle" | "connecting" | "connected" | "disconnected";

export function getColyseusEndpoint(input: EndpointInput): string {
  if (input.isDev) {
    return "ws://localhost:2567";
  }

  const scheme = input.protocol === "https:" ? "wss" : "ws";
  return `${scheme}://${input.host}`;
}

export function mapJoinErrorToMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);

  if (message.includes("ROOM_FULL")) {
    return "房间已满，当前版本仅支持 2 名玩家";
  }

  if (
    message.toLowerCase().includes("not found") ||
    message.toLowerCase().includes("not available")
  ) {
    return "房间不存在或已失效，请确认房间码";
  }

  return "连接失败，请稍后重试";
}

export function calculatePingEstimateMs(clientTime: number, receivedAt: number): number {
  return Math.max(0, Math.round(receivedAt - clientTime));
}

export function formatFireResultMessage(result: FireResultMessage, localSessionId: string | null): string | null {
  if (result.shooterSessionId !== localSessionId) return null;
  if (result.reason === "target_dead") return "目标已死亡，等待复活";
  if (!result.hit) return "未命中";
  if (result.targetKilled) return `命中 +${result.damage}，目标已死亡`;
  return `命中 +${result.damage}，目标 HP: ${result.targetHp ?? "-"}`;
}

export type NetworkClientEvents = {
  onStatusChange(status: ConnectionStatus): void;
  onError(message: string): void;
  onPlayerLeft(sessionId: string): void;
  onFireResult(result: FireResultMessage): void;
  onTargetRespawned(targetId: string): void;
};

export class NetworkClient {
  private client: Client;
  private room: Room | null = null;
  private events: NetworkClientEvents;
  private currentStatus: ConnectionStatus = "idle";
  private lastLeftSessionId: string | null = null;
  private pingEstimateMs: number | null = null;

  constructor(events: NetworkClientEvents) {
    this.client = new Client(
      getColyseusEndpoint({
        isDev: import.meta.env.DEV,
        protocol: window.location.protocol,
        host: window.location.host
      })
    );
    this.events = events;
  }

  get sessionId(): string | null {
    return this.room?.sessionId ?? null;
  }

  get roomId(): string | null {
    return this.room?.roomId ?? null;
  }

  get status(): ConnectionStatus {
    return this.currentStatus;
  }

  get playerLeftSessionId(): string | null {
    return this.lastLeftSessionId;
  }

  getPingEstimateMs(): number | null {
    return this.pingEstimateMs;
  }

  async createRoom(): Promise<void> {
    await this.connect(() => this.client.create(ROOM_NAME));
  }

  async joinRoom(roomId: string): Promise<void> {
    const cleanRoomId = roomId.trim();

    if (!cleanRoomId) {
      this.events.onError("请输入房间码");
      return;
    }

    await this.connect(() => this.client.joinById(cleanRoomId));
  }

  sendMove(move: MoveMessage): void {
    if (!this.room || this.currentStatus !== "connected") {
      return;
    }

    this.room.send("move", move);
  }

  sendPing(clientTime: number): void {
    if (!this.room || this.currentStatus !== "connected") {
      return;
    }

    this.room.send("ping", { clientTime });
  }

  sendFire(clientTime: number): void {
    if (!this.room || this.currentStatus !== "connected") return;
    this.room.send("fire", { clientTime });
  }

  getPlayersSnapshot(): ClientPlayerSnapshot[] {
    const players = this.room?.state?.players;

    if (!players || typeof players.forEach !== "function") {
      return [];
    }

    const result: ClientPlayerSnapshot[] = [];

    players.forEach((player: Record<string, unknown>, sessionId: string) => {
      if (
        typeof player.name === "string" &&
        typeof player.x === "number" &&
        typeof player.y === "number" &&
        typeof player.z === "number" &&
        typeof player.rotationY === "number" &&
        typeof player.pitch === "number" &&
        (player.color === "blue" || player.color === "orange")
      ) {
        result.push({
          sessionId,
          name: player.name,
          x: player.x,
          y: player.y,
          z: player.z,
          rotationY: player.rotationY,
          pitch: player.pitch,
          color: player.color
        });
      }
    });

    return result;
  }

  getTargetsSnapshot(): TargetSnapshot[] {
    const targets = this.room?.state?.targets;
    if (!targets || typeof targets.forEach !== "function") return [];
    const result: TargetSnapshot[] = [];
    targets.forEach((target: Record<string, unknown>) => {
      if (
        typeof target.id === "string" && typeof target.name === "string" &&
        typeof target.x === "number" && typeof target.y === "number" &&
        typeof target.z === "number" && typeof target.radius === "number" &&
        typeof target.height === "number" && typeof target.hp === "number" &&
        typeof target.maxHp === "number" && typeof target.alive === "boolean" &&
        typeof target.respawnAt === "number"
      ) {
        result.push({
          id: target.id, name: target.name, x: target.x, y: target.y,
          z: target.z, radius: target.radius, height: target.height,
          hp: target.hp, maxHp: target.maxHp, alive: target.alive, respawnAt: target.respawnAt
        });
      }
    });
    return result;
  }

  setFireResultHandler(handler: (result: FireResultMessage) => void): void {
    this.events.onFireResult = handler;
  }

  setTargetRespawnedHandler(handler: (targetId: string) => void): void {
    this.events.onTargetRespawned = handler;
  }

  leave(): void {
    if (this.room) {
      this.room.leave();
      this.room = null;
      this.setStatus("disconnected");
    }
  }

  private async connect(joiner: () => Promise<Room>): Promise<void> {
    this.setStatus("connecting");

    try {
      const room = await joiner();
      this.room = room;
      this.lastLeftSessionId = null;
      this.setStatus("connected");

      room.onLeave(() => {
        this.setStatus("disconnected");
      });

      room.onMessage("playerLeft", (message: { sessionId?: string }) => {
        if (typeof message.sessionId === "string") {
          this.lastLeftSessionId = message.sessionId;
          this.events.onPlayerLeft(message.sessionId);
        }
      });

      room.onMessage("pong", (message: { clientTime?: unknown }) => {
        if (typeof message.clientTime !== "number") {
          return;
        }

        this.pingEstimateMs = calculatePingEstimateMs(message.clientTime, performance.now());
      });

      room.onMessage("fireResult", (message: FireResultMessage) => {
        this.events.onFireResult(message);
      });
      room.onMessage("targetRespawned", (message: { targetId?: unknown }) => {
        if (typeof message.targetId === "string") {
          this.events.onTargetRespawned(message.targetId);
        }
      });
    } catch (error) {
      this.room = null;
      this.setStatus("idle");
      this.events.onError(mapJoinErrorToMessage(error));
    }
  }

  private setStatus(status: ConnectionStatus): void {
    this.currentStatus = status;
    this.events.onStatusChange(status);
  }
}
