import { Schema, type } from "@colyseus/schema";
import type { PlayerColor, ServerPlayerRecord } from "../../../shared/types";

export class PlayerState extends Schema {
  @type("string") sessionId = "";
  @type("string") name = "";
  @type("number") x = 0;
  @type("number") y = 0;
  @type("number") z = 0;
  @type("number") rotationY = 0;
  @type("string") color: PlayerColor = "blue";
  @type("number") lastMoveAt = 0;

  applyRecord(record: ServerPlayerRecord): void {
    this.sessionId = record.sessionId;
    this.name = record.name;
    this.x = record.x;
    this.y = record.y;
    this.z = record.z;
    this.rotationY = record.rotationY;
    this.color = record.color;
    this.lastMoveAt = record.lastMoveAt;
  }
}

export function createPlayerState(record: ServerPlayerRecord): PlayerState {
  const state = new PlayerState();
  state.applyRecord(record);
  return state;
}
