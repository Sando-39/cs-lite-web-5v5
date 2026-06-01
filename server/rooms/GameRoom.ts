import { Room, type Client } from "colyseus";
import { AI_DAMAGE, AI_DETECTION_RANGE_UNITS, AI_FIELD_OF_VIEW_DEGREES, AI_FIRE_INTERVAL_MS, AI_MOVE_SPEED_UNITS_PER_SECOND, AI_UPDATE_HZ, AI_UPDATE_INTERVAL_MS, MAX_PLAYERS, PLAYER_REGEN_DELAY_MS, PLAYER_REGEN_PER_SECOND, RIFLE_DAMAGE, SERVER_SIMULATION_HZ, SERVER_SIMULATION_INTERVAL_MS } from "../../shared/constants.js";
import type { FireMessage, FireResultMessage, ReloadResult, WeaponFireMessage, WeaponFireResult } from "../../shared/types.js";
import { isWeaponId, getWeaponConfig } from "../../shared/weapons.js";
import { createPlayerRecord } from "../logic/playerSlots.js";
import {
  normalizeMoveMessage,
  validateAndClampMove
} from "../logic/movement.js";
import { collidesWithAnyMapCollider } from "../../shared/collision.js";
import { STATIC_TARGETS } from "../../shared/staticTargets.js";
import { GameState } from "./schema/GameState.js";
import { createPlayerState } from "./schema/PlayerState.js";
import { createTargetState } from "./schema/TargetState.js";
import { AI_ENEMIES } from "../../shared/aiEnemies.js";
import { createAiEnemyState } from "./schema/AiEnemyState.js";
import { applyTargetDamage, createShotRay, intersectRayWithAiEnemy, intersectRayWithStaticTarget, respawnTargetIfReady } from "../logic/combat.js";
import { applySpreadRecovery, canFireWeapon, completeReloadIfReady, createInitialWeaponInventory, startReload, switchWeapon, updateWeaponAfterAcceptedFire } from "../logic/weaponSystem.js";
import { chooseNearestVisiblePlayer, damagePlayerWithoutKilling, updateAiPatrolPosition } from "../logic/aiSystem.js";
import { PlayerWeaponState } from "./schema/PlayerWeaponState.js";

type PingMessage = {
  clientTime?: unknown;
};

type PongMessage = {
  clientTime: number;
  serverTime: number;
};

export class GameRoom extends Room<{ state: GameState }> {
  maxClients = MAX_PLAYERS;

  private lastTickMs = 0;
  private lastAiUpdateMs = 0;
  private lastFireProcessingMs = 0;
  private fireAcceptedCounter = 0;
  private fireRejectedCounter = 0;
  private lastServerStatsBroadcastAt = 0;
  private targetedMessagesThisSecond = 0;
  private broadcastMessagesThisSecond = 0;
  private lastMessageCounterResetAt = Date.now();
  private lastAiUpdateAt = Date.now();

  private sendToSession(sessionId: string, type: string, message: unknown): boolean {
    const client = this.clients.find(c => c.sessionId === sessionId);
    if (!client) return false;
    client.send(type, message);
    return true;
  }

  private sendTargeted(sessionId: string, type: string, message: unknown): void {
    if (this.sendToSession(sessionId, type, message)) this.targetedMessagesThisSecond++;
  }

  private broadcastCounted(type: string, message: unknown): void {
    this.broadcast(type, message);
    this.broadcastMessagesThisSecond++;
  }

  onCreate(): void {
    this.setState(new GameState());

    // setPatchRate not available in this Colyseus version

    // Static targets removed in v0.4.1 — gameplay uses AI enemies only.
    // for (const targetConfig of STATIC_TARGETS) {
    //   this.state.targets.set(targetConfig.id, createTargetState(targetConfig));
    // }

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

    this.onMessage("weaponFire", (client, message: unknown) => { this.handleWeaponFire(client.sessionId, message, Date.now()); });
    this.onMessage("reload", (client, message: unknown) => { this.handleReload(client.sessionId, message, Date.now()); });
    this.onMessage("switchWeapon", (client, message: unknown) => { this.handleSwitchWeapon(client.sessionId, message); });

    let lastSimAt = Date.now();
    this.setSimulationInterval(() => {
      const tickStart = performance.now();
      const now = Date.now();
      const deltaSeconds = (now - lastSimAt) / 1000;
      lastSimAt = now;
      this.completeReloads(now);
      this.recoverWeaponSpread(deltaSeconds);
      if (now - this.lastAiUpdateAt >= AI_UPDATE_INTERVAL_MS) {
        const aiDeltaSeconds = (now - this.lastAiUpdateAt) / 1000;
        this.lastAiUpdateAt = now;
        const aiStart = performance.now();
        this.updateAiEnemies(now, aiDeltaSeconds);
        this.lastAiUpdateMs = performance.now() - aiStart;
      } else {
        this.lastAiUpdateMs = 0;
      }
      this.regeneratePlayers(now, deltaSeconds);
      this.respawnTargetsIfReady(now);
      this.lastTickMs = performance.now() - tickStart;

      if (now - this.lastServerStatsBroadcastAt >= 1000) {
        this.lastServerStatsBroadcastAt = now;
        this.broadcastServerDebugStats(now);
      }
    }, SERVER_SIMULATION_INTERVAL_MS);
  }

  onJoin(client: Client): void {
    if (this.state.players.size >= MAX_PLAYERS) {
      throw new Error("ROOM_FULL");
    }

    const occupiedSlots = new Set<number>();
    for (const p of this.state.players.values()) {
      const match = p.name.match(/^Player (\d+)$/);
      if (match) occupiedSlots.add(parseInt(match[1]));
    }
    let slotIndex = 0;
    while (occupiedSlots.has(slotIndex + 1)) slotIndex++;
    const record = createPlayerRecord(client.sessionId, slotIndex, Date.now());

    this.state.players.set(client.sessionId, createPlayerState(record));
    const playerState = this.state.players.get(client.sessionId)!;
    const inventory = createInitialWeaponInventory();
    playerState.activeWeaponId = inventory.activeWeaponId;
    for (const weapon of Object.values(inventory.weapons)) {
      const weaponState = new PlayerWeaponState();
      weaponState.applySnapshot(weapon);
      playerState.weapons.set(weapon.weaponId, weaponState);
    }
  }

  onLeave(client: Client): void {
    this.state.players.delete(client.sessionId);
    this.broadcastCounted("playerLeft", { sessionId: client.sessionId });
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
      this.broadcastCounted("targetRespawned", { targetId: target.id, hp: target.hp });
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
      this.sendTargeted(sessionId, "fireResult", result);
      return result;
    }
    const target = this.state.targets.get("target-1");
    if (!target) {
      const result: FireResultMessage = { shooterSessionId: sessionId, hit: false, targetId: null, damage: 0, targetHp: null, targetKilled: false, reason: "miss" };
      this.sendTargeted(sessionId, "fireResult", result);
      return result;
    }
    if (!target.alive) {
      const result: FireResultMessage = { shooterSessionId: sessionId, hit: false, targetId: target.id, damage: 0, targetHp: target.hp, targetKilled: false, reason: "target_dead" };
      this.sendTargeted(sessionId, "fireResult", result);
      return result;
    }
    const ray = createShotRay({ x: player.x, y: player.y, z: player.z, rotationY: player.rotationY, pitch: player.pitch });
    const hit = intersectRayWithStaticTarget(ray, target);
    if (!hit) {
      const result: FireResultMessage = { shooterSessionId: sessionId, hit: false, targetId: target.id, damage: 0, targetHp: target.hp, targetKilled: false, reason: "miss" };
      this.sendTargeted(sessionId, "fireResult", result);
      return result;
    }
    const damage = applyTargetDamage(target, RIFLE_DAMAGE, Date.now());
    target.hp = damage.hp;
    target.alive = damage.alive;
    target.respawnAt = damage.respawnAt;
    const result: FireResultMessage = { shooterSessionId: sessionId, hit: true, targetId: target.id, damage: RIFLE_DAMAGE, targetHp: target.hp, targetKilled: damage.killed, reason: "hit" };
    this.sendTargeted(sessionId, "fireResult", result);
    return result;
  }

  private normalizeFireMessage(message: unknown): FireMessage | null {
    if (!message || typeof message !== "object") return null;
    const candidate = message as Record<string, unknown>;
    if (typeof candidate.clientTime !== "number" || !Number.isFinite(candidate.clientTime)) return null;
    return { clientTime: candidate.clientTime };
  }

  handleSwitchWeaponForTest(sessionId: string, message: unknown): void { this.handleSwitchWeapon(sessionId, message); }

  private handleSwitchWeapon(sessionId: string, message: unknown): void {
    const player = this.state.players.get(sessionId);
    const weaponId = this.normalizeWeaponIdMessage(message);
    if (!player || !weaponId) return;
    const ar4 = player.weapons.get("ar4")?.toSnapshot();
    const r47 = player.weapons.get("r47")?.toSnapshot();
    if (!ar4 || !r47) return;
    const nextInventory = switchWeapon({ activeWeaponId: player.activeWeaponId, weapons: { ar4, r47 } }, weaponId);
    player.activeWeaponId = nextInventory.activeWeaponId;
    player.weapons.get("ar4")?.applySnapshot(nextInventory.weapons.ar4);
    player.weapons.get("r47")?.applySnapshot(nextInventory.weapons.r47);
  }

  handleReloadForTest(sessionId: string, message: unknown, now: number): ReloadResult | null { return this.handleReload(sessionId, message, now); }

  private handleReload(sessionId: string, message: unknown, now: number): ReloadResult | null {
    const weaponId = this.normalizeWeaponIdMessage(message);
    const player = this.state.players.get(sessionId);
    if (!weaponId || !player) return null;
    const weapon = player.weapons.get(weaponId);
    if (!weapon) return null;
    const result = startReload(weapon.toSnapshot(), weaponId, now);
    weapon.applySnapshot(result.weapon);
    const reloadResult: ReloadResult = { sessionId, weaponId, started: result.started, reason: result.reason, reloadEndsAt: result.weapon.reloadEndsAt };
    this.sendTargeted(sessionId, "reloadResult", reloadResult);
    return reloadResult;
  }

  handleWeaponFireForTest(sessionId: string, message: unknown, now: number): WeaponFireResult | null { return this.handleWeaponFire(sessionId, message, now); }

  private handleWeaponFire(sessionId: string, message: unknown, now: number): WeaponFireResult | null {
    const fireStart = performance.now();
    const normalized = this.normalizeWeaponFireMessage(message);
    const player = this.state.players.get(sessionId);
    if (!normalized || !player) { this.lastFireProcessingMs = performance.now() - fireStart; return null; }
    const weapon = player.weapons.get(normalized.weaponId);
    if (!weapon) { this.lastFireProcessingMs = performance.now() - fireStart; return null; }
    if (normalized.weaponId !== player.activeWeaponId) { this.lastFireProcessingMs = performance.now() - fireStart; return null; }
    const canFire = canFireWeapon(weapon.toSnapshot(), normalized.weaponId, now);
    if (!canFire.allowed) {
      this.fireRejectedCounter++;
      const rejected: WeaponFireResult = { shooterSessionId: sessionId, weaponId: normalized.weaponId, accepted: false, reason: canFire.reason, ammoInMag: weapon.ammoInMag, reserveAmmo: weapon.reserveAmmo, hit: false, targetType: null, targetId: null, damage: 0, targetHp: null, targetKilled: false };
      if (canFire.reason !== "cooldown") {
        this.sendTargeted(sessionId, "weaponFireResult", rejected);
      }
      this.lastFireProcessingMs = performance.now() - fireStart;
      return rejected;
    }
    this.fireAcceptedCounter++;
    const updatedWeapon = updateWeaponAfterAcceptedFire(weapon.toSnapshot(), normalized.weaponId, now);
    weapon.applySnapshot(updatedWeapon);
    const weaponConfig = getWeaponConfig(normalized.weaponId);
    const ray = createShotRay({ x: player.x, y: player.y, z: player.z, rotationY: player.rotationY, pitch: player.pitch });
    let hitAiId: string | null = null;
    let targetHp: number | null = null;
    let targetKilled = false;
    for (const ai of this.state.aiEnemies.values()) {
      const hit = intersectRayWithAiEnemy(ray, { id: ai.id, x: ai.x, y: ai.y, z: ai.z, radius: 0.5, height: 1.8, alive: ai.alive }, weaponConfig.range);
      if (!hit) continue;
      // Check if a wall blocks the shot before it reaches this AI
      const distToAi = Math.sqrt((ai.x - player.x) ** 2 + (ai.z - player.z) ** 2);
      let blocked = false;
      const steps = Math.ceil(distToAi / 0.5);
      for (let s = 1; s < steps; s++) {
        const t = s * 0.5;
        const cx = player.x + ray.direction.x * t;
        const cz = player.z + ray.direction.z * t;
        if (collidesWithAnyMapCollider(cx, cz, 0.2)) { blocked = true; break; }
      }
      if (blocked) continue;
      ai.hp = Math.max(0, ai.hp - weaponConfig.damage);
      hitAiId = ai.id;
      targetHp = ai.hp;
      if (ai.hp === 0) {
        ai.alive = false; ai.state = "respawning"; ai.respawnAt = now + ai.respawnDelayMs; ai.targetSessionId = ""; targetKilled = true;
        this.broadcastCounted("aiEvent", { aiId: ai.id, type: "killed" });
      }
      break;
    }
    const result: WeaponFireResult = { shooterSessionId: sessionId, weaponId: normalized.weaponId, accepted: true, reason: "fired", ammoInMag: weapon.ammoInMag, reserveAmmo: weapon.reserveAmmo, hit: hitAiId !== null, targetType: hitAiId ? "ai" : null, targetId: hitAiId, damage: hitAiId ? weaponConfig.damage : 0, targetHp, targetKilled };
    this.sendTargeted(sessionId, "weaponFireResult", result);
    this.lastFireProcessingMs = performance.now() - fireStart;
    return result;
  }

  damagePlayerForTest(sessionId: string, sourceId: string, damage: number): void { this.damagePlayer(sessionId, sourceId, damage, Date.now()); }

  private damagePlayer(sessionId: string, sourceId: string, damage: number, now: number): void {
    const player = this.state.players.get(sessionId);
    if (!player) return;
    player.hp = damagePlayerWithoutKilling(player.hp, damage);
    player.lastDamagedAt = now;
    this.sendTargeted(sessionId, "playerDamaged", { sessionId, damage, hp: player.hp, source: "ai", sourceId });
  }

  regeneratePlayersForTest(now: number, deltaSeconds: number): void { this.regeneratePlayers(now, deltaSeconds); }

  private regeneratePlayers(now: number, deltaSeconds: number): void {
    for (const player of this.state.players.values()) {
      if (player.hp >= player.maxHp) continue;
      if (now - player.lastDamagedAt < PLAYER_REGEN_DELAY_MS) continue;
      player.hp = Math.min(player.maxHp, player.hp + PLAYER_REGEN_PER_SECOND * deltaSeconds);
    }
  }

  private completeReloads(now: number): void {
    for (const player of this.state.players.values())
      for (const weapon of player.weapons.values())
        weapon.applySnapshot(completeReloadIfReady(weapon.toSnapshot(), weapon.weaponId, now));
  }

  private recoverWeaponSpread(deltaSeconds: number): void {
    for (const player of this.state.players.values())
      for (const weapon of player.weapons.values())
        weapon.applySnapshot(applySpreadRecovery(weapon.toSnapshot(), weapon.weaponId, deltaSeconds));
  }

  private updateAiEnemies(now: number, deltaSeconds: number): void {
    const players = Array.from(this.state.players.values()).map(p => ({ sessionId: p.sessionId, x: p.x, z: p.z }));
    for (const ai of this.state.aiEnemies.values()) {
      if (!ai.alive) {
        if (ai.respawnAt > 0 && now >= ai.respawnAt) {
          ai.hp = ai.maxHp; ai.alive = true; ai.state = "patrol"; ai.respawnAt = 0; ai.targetSessionId = "";
          this.broadcastCounted("aiEvent", { aiId: ai.id, type: "respawned" });
        }
        continue;
      }
      const target = chooseNearestVisiblePlayer({ x: ai.x, z: ai.z, rotationY: ai.rotationY }, players, AI_DETECTION_RANGE_UNITS, AI_FIELD_OF_VIEW_DEGREES);
      if (target) {
        ai.state = "attack"; ai.targetSessionId = target.sessionId;
        ai.rotationY = Math.atan2(target.x - ai.x, target.z - ai.z);
        if (now >= ai.nextShotAt) {
          ai.nextShotAt = now + AI_FIRE_INTERVAL_MS;
          this.damagePlayer(target.sessionId, ai.id, AI_DAMAGE, now);
        }
        continue;
      }
      ai.state = "patrol"; ai.targetSessionId = "";
      const config = AI_ENEMIES.find(c => c.id === ai.id);
      if (!config) continue;
      const patrol = updateAiPatrolPosition({ x: ai.x, z: ai.z, patrolIndex: ai.patrolIndex }, config.waypoints, AI_MOVE_SPEED_UNITS_PER_SECOND, deltaSeconds);
      ai.x = patrol.x; ai.z = patrol.z; ai.rotationY = patrol.rotationY; ai.patrolIndex = patrol.patrolIndex;
    }
  }

  private broadcastServerDebugStats(now: number): void {
    const stats = {
      serverTime: now,
      tickMs: Math.round(this.lastTickMs * 100) / 100,
      aiUpdateMs: Math.round(this.lastAiUpdateMs * 100) / 100,
      fireProcessingMs: Math.round(this.lastFireProcessingMs * 100) / 100,
      playerCount: this.state.players.size,
      aiCount: this.state.aiEnemies.size,
      aliveAiCount: Array.from(this.state.aiEnemies.values()).filter(a => a.alive).length,
      fireAcceptedPerSecond: this.fireAcceptedCounter,
      fireRejectedPerSecond: this.fireRejectedCounter,
      targetedMessagesPerSecond: this.targetedMessagesThisSecond,
      broadcastMessagesPerSecond: this.broadcastMessagesThisSecond,
      aiUpdateHz: AI_UPDATE_HZ,
      simulationHz: SERVER_SIMULATION_HZ,
      statePatchHz: null
    };
    this.fireAcceptedCounter = 0;
    this.fireRejectedCounter = 0;
    this.targetedMessagesThisSecond = 0;
    this.broadcastMessagesThisSecond = 0;
    this.broadcastCounted("serverDebugStats", stats);
  }

  private normalizeWeaponFireMessage(message: unknown): WeaponFireMessage | null {
    if (!message || typeof message !== "object") return null;
    const c = message as Record<string, unknown>;
    if (!isWeaponId(c.weaponId) || typeof c.clientTime !== "number" || !Number.isFinite(c.clientTime)) return null;
    return { weaponId: c.weaponId, clientTime: c.clientTime };
  }

  private normalizeWeaponIdMessage(message: unknown): "ar4" | "r47" | null {
    if (!message || typeof message !== "object") return null;
    const c = message as Record<string, unknown>;
    return isWeaponId(c.weaponId) ? c.weaponId : null;
  }
}
