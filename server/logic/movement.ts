import {
  CAMERA_HEIGHT,
  MAP_HALF_SIZE,
  MAX_SERVER_MOVE_SPEED_UNITS_PER_SECOND
} from "../../shared/constants.js";
import type { MoveMessage, ServerPlayerRecord } from "../../shared/types.js";

export type ValidatedMove = {
  accepted: boolean;
  x: number;
  y: number;
  z: number;
  rotationY: number;
  reason: "ok" | "clamped";
};

export function normalizeMoveMessage(message: unknown): MoveMessage | null {
  if (!message || typeof message !== "object") {
    return null;
  }

  const candidate = message as Record<string, unknown>;

  if (
    typeof candidate.x !== "number" ||
    typeof candidate.y !== "number" ||
    typeof candidate.z !== "number" ||
    typeof candidate.rotationY !== "number"
  ) {
    return null;
  }

  if (
    !Number.isFinite(candidate.x) ||
    !Number.isFinite(candidate.y) ||
    !Number.isFinite(candidate.z) ||
    !Number.isFinite(candidate.rotationY)
  ) {
    return null;
  }

  return {
    x: candidate.x,
    y: candidate.y,
    z: candidate.z,
    rotationY: candidate.rotationY
  };
}

export function clampToMapBounds(value: number): number {
  return Math.max(-MAP_HALF_SIZE, Math.min(MAP_HALF_SIZE, value));
}

export function validateAndClampMove(
  player: ServerPlayerRecord,
  move: MoveMessage,
  now: number
): ValidatedMove {
  const elapsedMs = Math.max(16, now - player.lastMoveAt);
  const elapsedSeconds = elapsedMs / 1000;
  const maxDistance =
    MAX_SERVER_MOVE_SPEED_UNITS_PER_SECOND * elapsedSeconds + 0.05;

  const targetX = clampToMapBounds(move.x);
  const targetZ = clampToMapBounds(move.z);

  const dx = targetX - player.x;
  const dz = targetZ - player.z;
  const distance = Math.sqrt(dx * dx + dz * dz);

  if (distance <= maxDistance) {
    return {
      accepted: true,
      x: targetX,
      y: CAMERA_HEIGHT,
      z: targetZ,
      rotationY: move.rotationY,
      reason: "ok"
    };
  }

  const scale = maxDistance / distance;

  return {
    accepted: true,
    x: clampToMapBounds(player.x + dx * scale),
    y: CAMERA_HEIGHT,
    z: clampToMapBounds(player.z + dz * scale),
    rotationY: move.rotationY,
    reason: "clamped"
  };
}
