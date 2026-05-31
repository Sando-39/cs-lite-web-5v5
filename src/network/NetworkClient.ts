import { Client, type Room } from "@colyseus/sdk";
import { ROOM_NAME } from "../../shared/constants";
import type { AiEventMessage, ClientPlayerSnapshot, FireResultMessage, MoveMessage, PlayerDamagedMessage, PlayerWeaponSnapshot, ReloadResult, ServerDebugStatsMessage, TargetSnapshot, WeaponFireResult } from "../../shared/types";
import { WEAPONS, type WeaponId } from "../../shared/weapons";
import { MetricWindowCounter, MetricSeries } from "../game/DebugMetrics";

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

export function formatWeaponFireResultMessage(result: WeaponFireResult, localSessionId: string | null): string | null {
  if (result.shooterSessionId !== localSessionId) return null;
  const weaponName = WEAPONS[result.weaponId]?.name ?? result.weaponId;
  if (!result.accepted) {
    if (result.reason === "empty_mag") return "弹匣为空，按 R 换弹";
    if (result.reason === "reloading") return "正在换弹";
    return null;
  }
  if (!result.hit) return `${weaponName} 未命中`;
  if (result.targetKilled) return `${weaponName} 命中 +${result.damage}，目标已击倒`;
  return `${weaponName} 命中 +${result.damage}，目标 HP: ${result.targetHp ?? "-"}`;
}

export type NetworkClientEvents = {
  onStatusChange(status: ConnectionStatus): void;
  onError(message: string): void;
  onPlayerLeft(sessionId: string): void;
  onFireResult(result: FireResultMessage): void;
  onTargetRespawned(targetId: string): void;
  onWeaponFireResult(result: WeaponFireResult): void;
  onReloadResult(result: ReloadResult): void;
  onPlayerDamaged(message: PlayerDamagedMessage): void;
  onAiEvent(message: AiEventMessage): void;
  onServerDebugStats(stats: ServerDebugStatsMessage): void;
};

export class NetworkClient {
  private client: Client;
  private room: Room | null = null;
  private events: NetworkClientEvents;
  private currentStatus: ConnectionStatus = "idle";
  private lastLeftSessionId: string | null = null;
  private pingEstimateMs: number | null = null;
  private moveSendCounter = new MetricWindowCounter(1000);
  private fireSendCounter = new MetricWindowCounter(1000);
  private reloadSendCounter = new MetricWindowCounter(1000);
  private switchWeaponSendCounter = new MetricWindowCounter(1000);
  private messagesReceivedCounter = new MetricWindowCounter(1000);
  private pingSeries = new MetricSeries(120);

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

  getPingSeries(): MetricSeries { return this.pingSeries; }

  getNetworkDebugStats(now: number) {
    return {
      moveSendsPerSecond: this.moveSendCounter.getRate(now),
      fireSendsPerSecond: this.fireSendCounter.getRate(now),
      reloadSendsPerSecond: this.reloadSendCounter.getRate(now),
      messagesReceivedPerSecond: this.messagesReceivedCounter.getRate(now),
      webSocketBufferedAmount: null as number | null
    };
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

    this.moveSendCounter.increment(performance.now());
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

  sendWeaponFire(weaponId: WeaponId, clientTime: number): void {
    if (!this.room || this.currentStatus !== "connected") return;
    this.fireSendCounter.increment(performance.now());
    this.room.send("weaponFire", { weaponId, clientTime });
  }

  sendReload(weaponId: WeaponId, clientTime: number): void {
    if (!this.room || this.currentStatus !== "connected") return;
    this.reloadSendCounter.increment(performance.now());
    this.room.send("reload", { weaponId, clientTime });
  }

  sendSwitchWeapon(weaponId: WeaponId, clientTime: number): void {
    if (!this.room || this.currentStatus !== "connected") return;
    this.switchWeaponSendCounter.increment(performance.now());
    this.room.send("switchWeapon", { weaponId, clientTime });
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
          color: player.color,
          hp: typeof player.hp === "number" ? player.hp : 100,
          maxHp: typeof player.maxHp === "number" ? player.maxHp : 100,
          lastDamagedAt: typeof player.lastDamagedAt === "number" ? player.lastDamagedAt : 0,
          activeWeaponId: typeof player.activeWeaponId === "string" && (player.activeWeaponId === "ar4" || player.activeWeaponId === "r47") ? player.activeWeaponId : "ar4"
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

  getLocalWeaponSnapshots(): PlayerWeaponSnapshot[] {
    const localSessionId = this.sessionId;
    const players = this.room?.state?.players;
    if (!localSessionId || !players) return [];
    const player = players.get(localSessionId);
    if (!player?.weapons || typeof player.weapons.forEach !== "function") return [];
    const result: PlayerWeaponSnapshot[] = [];
    player.weapons.forEach((weapon: Record<string, unknown>) => {
      if ((weapon.weaponId === "ar4" || weapon.weaponId === "r47") && typeof weapon.ammoInMag === "number" && typeof weapon.reserveAmmo === "number" && typeof weapon.isReloading === "boolean" && typeof weapon.reloadEndsAt === "number" && typeof weapon.nextFireAt === "number" && typeof weapon.currentSpread === "number" && typeof weapon.recoilIndex === "number") {
        result.push({ weaponId: weapon.weaponId, ammoInMag: weapon.ammoInMag, reserveAmmo: weapon.reserveAmmo, isReloading: weapon.isReloading, reloadEndsAt: weapon.reloadEndsAt, nextFireAt: weapon.nextFireAt, currentSpread: weapon.currentSpread, recoilIndex: weapon.recoilIndex });
      }
    });
    return result;
  }

  getAiEnemiesSnapshot(): Array<{ id: string; name: string; x: number; y: number; z: number; rotationY: number; hp: number; maxHp: number; alive: boolean; state: string }> {
    const aiEnemies = this.room?.state?.aiEnemies;
    if (!aiEnemies || typeof aiEnemies.forEach !== "function") return [];
    const result: Array<{ id: string; name: string; x: number; y: number; z: number; rotationY: number; hp: number; maxHp: number; alive: boolean; state: string }> = [];
    aiEnemies.forEach((ai: Record<string, unknown>) => {
      if (typeof ai.id === "string" && typeof ai.name === "string" && typeof ai.x === "number" && typeof ai.y === "number" && typeof ai.z === "number" && typeof ai.rotationY === "number" && typeof ai.hp === "number" && typeof ai.maxHp === "number" && typeof ai.alive === "boolean" && typeof ai.state === "string") {
        result.push({ id: ai.id, name: ai.name, x: ai.x, y: ai.y, z: ai.z, rotationY: ai.rotationY, hp: ai.hp, maxHp: ai.maxHp, alive: ai.alive, state: ai.state });
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

  setWeaponFireResultHandler(handler: (result: WeaponFireResult) => void): void { this.events.onWeaponFireResult = handler; }
  setReloadResultHandler(handler: (result: ReloadResult) => void): void { this.events.onReloadResult = handler; }
  setPlayerDamagedHandler(handler: (message: PlayerDamagedMessage) => void): void { this.events.onPlayerDamaged = handler; }
  setAiEventHandler(handler: (message: AiEventMessage) => void): void { this.events.onAiEvent = handler; }
  setServerDebugStatsHandler(handler: (stats: ServerDebugStatsMessage) => void): void { this.events.onServerDebugStats = handler; }

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
        this.messagesReceivedCounter.increment(performance.now());
        if (typeof message.sessionId === "string") {
          this.lastLeftSessionId = message.sessionId;
          this.events.onPlayerLeft(message.sessionId);
        }
      });

      room.onMessage("pong", (message: { clientTime?: unknown }) => {
        this.messagesReceivedCounter.increment(performance.now());
        if (typeof message.clientTime !== "number") {
          return;
        }

        this.pingEstimateMs = calculatePingEstimateMs(message.clientTime, performance.now());
        this.pingSeries.push(this.pingEstimateMs!);
      });

      room.onMessage("fireResult", (message: FireResultMessage) => {
        this.messagesReceivedCounter.increment(performance.now());
        this.events.onFireResult(message);
      });
      room.onMessage("targetRespawned", (message: { targetId?: unknown }) => {
        this.messagesReceivedCounter.increment(performance.now());
        if (typeof message.targetId === "string") {
          this.events.onTargetRespawned(message.targetId);
        }
      });

      room.onMessage("weaponFireResult", (message: WeaponFireResult) => { this.messagesReceivedCounter.increment(performance.now()); this.events.onWeaponFireResult(message); });
      room.onMessage("reloadResult", (message: ReloadResult) => { this.messagesReceivedCounter.increment(performance.now()); this.events.onReloadResult(message); });
      room.onMessage("playerDamaged", (message: PlayerDamagedMessage) => { this.messagesReceivedCounter.increment(performance.now()); this.events.onPlayerDamaged(message); });
      room.onMessage("aiEvent", (message: AiEventMessage) => { this.messagesReceivedCounter.increment(performance.now()); this.events.onAiEvent(message); });
      room.onMessage("serverDebugStats", (message: ServerDebugStatsMessage) => { this.messagesReceivedCounter.increment(performance.now()); this.events.onServerDebugStats(message); });
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
