import { Schema, type } from "@colyseus/schema";
import { AI_MAX_HP, AI_RESPAWN_DELAY_MS } from "../../../shared/constants.js";
import type { AiEnemyConfig, AiStateKind } from "../../../shared/aiEnemies.js";
import { getAiSpawnY } from "../../../shared/aiEnemies.js";

export class AiEnemyState extends Schema {
  @type("string") id = "";
  @type("string") name = "";
  @type("number") x = 0;
  @type("number") y = getAiSpawnY();
  @type("number") z = 0;
  @type("number") rotationY = 0;
  @type("number") hp = AI_MAX_HP;
  @type("number") maxHp = AI_MAX_HP;
  @type("boolean") alive = true;
  @type("string") state: AiStateKind = "patrol";
  @type("number") patrolIndex = 0;
  @type("string") targetSessionId = "";
  @type("number") nextShotAt = 0;
  @type("number") respawnAt = 0;
  @type("number") respawnDelayMs = AI_RESPAWN_DELAY_MS;
  @type("string") faction = "enemy";
  @type("boolean") damageable = true;

  applyConfig(config: AiEnemyConfig): void {
    this.id = config.id; this.name = config.name;
    this.x = config.spawn.x; this.y = getAiSpawnY(); this.z = config.spawn.z;
    this.rotationY = config.rotationY; this.hp = AI_MAX_HP; this.maxHp = AI_MAX_HP;
    this.alive = true; this.state = "patrol"; this.patrolIndex = 0;
    this.targetSessionId = ""; this.nextShotAt = 0; this.respawnAt = 0;
    this.faction = config.faction;
    this.damageable = config.damageable;
  }
}

export function createAiEnemyState(config: AiEnemyConfig): AiEnemyState {
  const state = new AiEnemyState(); state.applyConfig(config); return state;
}
