import {
  CAMERA_HEIGHT,
  MAP_HALF_SIZE,
  MAX_SERVER_MOVE_SPEED_UNITS_PER_SECOND
} from "../../shared/constants";
import { resolveMapMovement } from "../../shared/collision";
import type { MoveMessage, ServerPlayerRecord } from "../../shared/types";

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

  const boundedTargetX = clampToMapBounds(move.x);
  const boundedTargetZ = clampToMapBounds(move.z);

  const dx = boundedTargetX - player.x;
  const dz = boundedTargetZ - player.z;
  const distance = Math.sqrt(dx * dx + dz * dz);

  const speedLimitedTarget =
    distance <= maxDistance
      ? { x: boundedTargetX, z: boundedTargetZ }
      : {
          x: player.x + dx * (maxDistance / distance),
          z: player.z + dz * (maxDistance / distance)
        };

  const resolved = resolveMapMovement(
    { x: player.x, z: player.z },
    speedLimitedTarget
  );

  const wasClamped =
    distance > maxDistance ||
    resolved.collided ||
    resolved.x !== move.x ||
    resolved.z !== move.z;

  return {
    accepted: true,
    x: resolved.x,
    y: CAMERA_HEIGHT,
    z: resolved.z,
    rotationY: move.rotationY,
    reason: wasClamped ? "clamped" : "ok"
  };
}
