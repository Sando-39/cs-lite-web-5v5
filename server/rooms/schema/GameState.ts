import { MapSchema, Schema, type } from "@colyseus/schema";
import { PlayerState } from "./PlayerState.js";
import { TargetState } from "./TargetState.js";

export class GameState extends Schema {
  @type({ map: PlayerState }) players = new MapSchema<PlayerState>();
  @type({ map: TargetState }) targets = new MapSchema<TargetState>();
}
