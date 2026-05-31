import { MapSchema, Schema, type } from "@colyseus/schema";
import type { PlayerColor, ServerPlayerRecord } from "../../../shared/types.js";
import type { WeaponId } from "../../../shared/weapons.js";
import { DEFAULT_WEAPON_ID } from "../../../shared/weapons.js";
import { PlayerWeaponState } from "./PlayerWeaponState.js";

export class PlayerState extends Schema {
  @type("string") sessionId = "";
  @type("string") name = "";
  @type("number") x = 0;
  @type("number") y = 0;
  @type("number") z = 0;
  @type("number") rotationY = 0;
  @type("number") pitch = 0;
  @type("string") color: PlayerColor = "blue";
  @type("number") lastMoveAt = 0;
  @type("number") hp = 100;
  @type("number") maxHp = 100;
  @type("number") lastDamagedAt = 0;
  @type("string") activeWeaponId: WeaponId = DEFAULT_WEAPON_ID;
  @type({ map: PlayerWeaponState }) weapons = new MapSchema<PlayerWeaponState>();

  applyRecord(record: ServerPlayerRecord): void {
    this.sessionId = record.sessionId;
    this.name = record.name;
    this.x = record.x;
    this.y = record.y;
    this.z = record.z;
    this.rotationY = record.rotationY;
    this.pitch = record.pitch;
    this.color = record.color;
    this.lastMoveAt = record.lastMoveAt;
    this.hp = record.hp;
    this.maxHp = record.maxHp;
    this.lastDamagedAt = record.lastDamagedAt;
    this.activeWeaponId = record.activeWeaponId;
  }
}

export function createPlayerState(record: ServerPlayerRecord): PlayerState {
  const state = new PlayerState();
  state.applyRecord(record);
  return state;
}
