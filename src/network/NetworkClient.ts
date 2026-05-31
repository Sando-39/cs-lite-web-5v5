import { Client, type Room } from "@colyseus/sdk";
import { ROOM_NAME } from "../../shared/constants";
import type { ClientPlayerSnapshot, MoveMessage } from "../../shared/types";

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

export type NetworkClientEvents = {
  onStatusChange(status: ConnectionStatus): void;
  onError(message: string): void;
  onPlayerLeft(sessionId: string): void;
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
