import { MAX_PLAYERS } from "../../shared/constants.js";
import type { ServerPlayerRecord } from "../../shared/types.js";
import { SPAWN_POINTS, type SpawnPoint } from "../config/spawns.js";

export function canAcceptPlayer(currentPlayerCount: number): boolean {
  return currentPlayerCount < MAX_PLAYERS;
}

export function getSpawnForSlot(slotIndex: number): SpawnPoint {
  const spawn = SPAWN_POINTS[slotIndex];

  if (!spawn) {
    throw new Error(`No spawn point configured for slot ${slotIndex}.`);
  }

  return spawn;
}

export function getColorForSlot(slotIndex: number): SpawnPoint["color"] {
  return getSpawnForSlot(slotIndex).color;
}

export function createPlayerRecord(
  sessionId: string,
  slotIndex: number,
  now: number
): ServerPlayerRecord {
  const spawn = getSpawnForSlot(slotIndex);

  return {
    sessionId,
    name: `Player ${slotIndex + 1}`,
    x: spawn.x,
    y: spawn.y,
    z: spawn.z,
    rotationY: spawn.rotationY,
    color: spawn.color,
    lastMoveAt: now
  };
}
