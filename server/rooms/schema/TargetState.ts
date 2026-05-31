import { Schema, type } from "@colyseus/schema";
import type { StaticTargetConfig } from "../../../shared/staticTargets.js";

export class TargetState extends Schema {
  @type("string") id = "";
  @type("string") name = "";
  @type("number") x = 0;
  @type("number") y = 0;
  @type("number") z = 0;
  @type("number") radius = 0.6;
  @type("number") height = 1.8;
  @type("number") hp = 100;
  @type("number") maxHp = 100;
  @type("boolean") alive = true;
  @type("number") respawnAt = 0;

  applyConfig(config: StaticTargetConfig): void {
    this.id = config.id;
    this.name = config.name;
    this.x = config.x;
    this.y = config.y;
    this.z = config.z;
    this.radius = config.radius;
    this.height = config.height;
    this.hp = config.maxHp;
    this.maxHp = config.maxHp;
    this.alive = true;
    this.respawnAt = 0;
  }
}

export function createTargetState(config: StaticTargetConfig): TargetState {
  const state = new TargetState();
  state.applyConfig(config);
  return state;
}
