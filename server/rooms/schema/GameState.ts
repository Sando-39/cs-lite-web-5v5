import { MapSchema, Schema, type } from "@colyseus/schema";
import { PlayerState } from "./PlayerState.js";

export class GameState extends Schema {
  @type({ map: PlayerState }) players = new MapSchema<PlayerState>();
}
