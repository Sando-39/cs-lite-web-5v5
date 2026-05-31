import { Room, type Client } from "colyseus";
import { MAX_PLAYERS, RIFLE_DAMAGE } from "../../shared/constants.js";
import type { FireMessage, FireResultMessage } from "../../shared/types.js";
import { createPlayerRecord } from "../logic/playerSlots.js";
import {
  normalizeMoveMessage,
  validateAndClampMove
} from "../logic/movement.js";
import { STATIC_TARGETS } from "../../shared/staticTargets.js";
import { GameState } from "./schema/GameState.js";
import { createPlayerState } from "./schema/PlayerState.js";
import { createTargetState } from "./schema/TargetState.js";
import { AI_ENEMIES } from "../../shared/aiEnemies.js";
import { createAiEnemyState } from "./schema/AiEnemyState.js";
import { applyTargetDamage, createShotRay, intersectRayWithStaticTarget, respawnTargetIfReady } from "../logic/combat.js";

type PingMessage = {
  clientTime?: unknown;
};

type PongMessage = {
  clientTime: number;
  serverTime: number;
};

export class GameRoom extends Room<{ state: GameState }> {
  maxClients = MAX_PLAYERS;

  onCreate(): void {
    this.setState(new GameState());

    for (const targetConfig of STATIC_TARGETS) {
      this.state.targets.set(targetConfig.id, createTargetState(targetConfig));
    }

    for (const aiConfig of AI_ENEMIES) {
      this.state.aiEnemies.set(aiConfig.id, createAiEnemyState(aiConfig));
    }

    this.onMessage("move", (client, message: unknown) => {
      this.handleMove(client.sessionId, message);
    });

    this.onMessage("ping", (client, message: PingMessage) => {
      const pong = this.createPong(message);

      if (pong) {
        client.send("pong", pong);
      }
    });

    this.onMessage("fire", (client, message: unknown) => {
      this.handleFire(client.sessionId, message);
    });

    this.setSimulationInterval(() => {
      this.respawnTargetsIfReady(Date.now());
    }, 250);
  }

  onJoin(client: Client): void {
    if (this.state.players.size >= MAX_PLAYERS) {
      throw new Error("ROOM_FULL");
    }

    const slotIndex = this.state.players.size;
    const record = createPlayerRecord(client.sessionId, slotIndex, Date.now());

    this.state.players.set(client.sessionId, createPlayerState(record));
  }

  onLeave(client: Client): void {
    this.state.players.delete(client.sessionId);
    this.broadcast("playerLeft", { sessionId: client.sessionId });
  }

  handleMoveForTest(sessionId: string, message: unknown): void {
    this.handleMove(sessionId, message);
  }

  createPongForTest(message: PingMessage): PongMessage {
    const pong = this.createPong(message);

    if (!pong) {
      throw new Error("INVALID_PING");
    }

    return pong;
  }

  handleFireForTest(sessionId: string, message: unknown): FireResultMessage | null {
    return this.handleFire(sessionId, message);
  }

  respawnTargetsIfReady(now: number): void {
    for (const target of this.state.targets.values()) {
      const result = respawnTargetIfReady(target, now);
      if (!result.respawned) continue;
      target.hp = result.hp;
      target.alive = result.alive;
      target.respawnAt = result.respawnAt;
      this.broadcast("targetRespawned", { targetId: target.id, hp: target.hp });
    }
  }

  private createPong(message: PingMessage): PongMessage | null {
    if (typeof message.clientTime !== "number" || !Number.isFinite(message.clientTime)) {
      return null;
    }

    return {
      clientTime: message.clientTime,
      serverTime: Date.now()
    };
  }

  private handleMove(sessionId: string, message: unknown): void {
    const player = this.state.players.get(sessionId);

    if (!player) {
      return;
    }

    const move = normalizeMoveMessage(message);

    if (!move) {
      return;
    }

    const result = validateAndClampMove(
      {
        sessionId: player.sessionId,
        name: player.name,
        x: player.x,
        y: player.y,
        z: player.z,
        rotationY: player.rotationY,
        pitch: player.pitch,
        color: player.color,
        lastMoveAt: player.lastMoveAt,
        hp: player.hp,
        maxHp: player.maxHp,
        lastDamagedAt: player.lastDamagedAt,
        activeWeaponId: player.activeWeaponId
      },
      move,
      Date.now()
    );

    if (!result.accepted) {
      return;
    }

    player.x = result.x;
    player.y = result.y;
    player.z = result.z;
    player.rotationY = result.rotationY;
    player.pitch = result.pitch;
    player.lastMoveAt = Date.now();
  }

  private handleFire(sessionId: string, message: unknown): FireResultMessage | null {
    const fire = this.normalizeFireMessage(message);
    if (!fire) return null;
    const player = this.state.players.get(sessionId);
    if (!player) {
      const result: FireResultMessage = { shooterSessionId: sessionId, hit: false, targetId: null, damage: 0, targetHp: null, targetKilled: false, reason: "invalid_player" };
      this.broadcast("fireResult", result);
      return result;
    }
    const target = this.state.targets.get("target-1");
    if (!target) {
      const result: FireResultMessage = { shooterSessionId: sessionId, hit: false, targetId: null, damage: 0, targetHp: null, targetKilled: false, reason: "miss" };
      this.broadcast("fireResult", result);
      return result;
    }
    if (!target.alive) {
      const result: FireResultMessage = { shooterSessionId: sessionId, hit: false, targetId: target.id, damage: 0, targetHp: target.hp, targetKilled: false, reason: "target_dead" };
      this.broadcast("fireResult", result);
      return result;
    }
    const ray = createShotRay({ x: player.x, y: player.y, z: player.z, rotationY: player.rotationY, pitch: player.pitch });
    const hit = intersectRayWithStaticTarget(ray, target);
    if (!hit) {
      const result: FireResultMessage = { shooterSessionId: sessionId, hit: false, targetId: target.id, damage: 0, targetHp: target.hp, targetKilled: false, reason: "miss" };
      this.broadcast("fireResult", result);
      return result;
    }
    const damage = applyTargetDamage(target, RIFLE_DAMAGE, Date.now());
    target.hp = damage.hp;
    target.alive = damage.alive;
    target.respawnAt = damage.respawnAt;
    const result: FireResultMessage = { shooterSessionId: sessionId, hit: true, targetId: target.id, damage: RIFLE_DAMAGE, targetHp: target.hp, targetKilled: damage.killed, reason: "hit" };
    this.broadcast("fireResult", result);
    return result;
  }

  private normalizeFireMessage(message: unknown): FireMessage | null {
    if (!message || typeof message !== "object") return null;
    const candidate = message as Record<string, unknown>;
    if (typeof candidate.clientTime !== "number" || !Number.isFinite(candidate.clientTime)) return null;
    return { clientTime: candidate.clientTime };
  }
}
