import {
  CAMERA_HEIGHT,
  MAP_HALF_SIZE,
  MAX_SERVER_MOVE_SPEED_UNITS_PER_SECOND,
  PLAYER_PITCH_MAX,
  PLAYER_PITCH_MIN
} from "../../shared/constants.js";
import { resolveMapMovement } from "../../shared/collision.js";
import type { MoveMessage, ServerPlayerRecord } from "../../shared/types.js";

export type ValidatedMove = {
  accepted: boolean;
  x: number;
  y: number;
  z: number;
  rotationY: number;
  pitch: number;
  reason: "ok" | "clamped";
};

export function normalizeMoveMessage(message: unknown): MoveMessage | null {
  if (!message || typeof message !== "object") return null;
  const candidate = message as Record<string, unknown>;
  if (
    typeof candidate.x !== "number" ||
    typeof candidate.y !== "number" ||
    typeof candidate.z !== "number" ||
    typeof candidate.rotationY !== "number" ||
    typeof candidate.pitch !== "number"
  ) return null;
  if (
    !Number.isFinite(candidate.x) ||
    !Number.isFinite(candidate.y) ||
    !Number.isFinite(candidate.z) ||
    !Number.isFinite(candidate.rotationY) ||
    !Number.isFinite(candidate.pitch)
  ) return null;
  return {
    x: candidate.x, y: candidate.y, z: candidate.z,
    rotationY: candidate.rotationY, pitch: candidate.pitch
  };
}

export function clampToMapBounds(value: number): number {
  return Math.max(-MAP_HALF_SIZE, Math.min(MAP_HALF_SIZE, value));
}

export function clampPitch(pitch: number): number {
  return Math.max(PLAYER_PITCH_MIN, Math.min(PLAYER_PITCH_MAX, pitch));
}

export function validateAndClampMove(
  player: ServerPlayerRecord, move: MoveMessage, now: number
): ValidatedMove {
  const elapsedMs = Math.max(16, now - player.lastMoveAt);
  const elapsedSeconds = elapsedMs / 1000;
  const maxDistance = MAX_SERVER_MOVE_SPEED_UNITS_PER_SECOND * elapsedSeconds + 0.05;
  const boundedTargetX = clampToMapBounds(move.x);
  const boundedTargetZ = clampToMapBounds(move.z);
  const dx = boundedTargetX - player.x;
  const dz = boundedTargetZ - player.z;
  const distance = Math.sqrt(dx * dx + dz * dz);
  const speedLimitedTarget = distance <= maxDistance
    ? { x: boundedTargetX, z: boundedTargetZ }
    : { x: player.x + dx * (maxDistance / distance), z: player.z + dz * (maxDistance / distance) };
  const resolved = resolveMapMovement({ x: player.x, z: player.z }, speedLimitedTarget);
  const pitch = clampPitch(move.pitch);
  const wasClamped = distance > maxDistance || resolved.collided ||
    resolved.x !== move.x || resolved.z !== move.z || pitch !== move.pitch;
  return { accepted: true, x: resolved.x, y: CAMERA_HEIGHT, z: resolved.z,
    rotationY: move.rotationY, pitch, reason: wasClamped ? "clamped" : "ok" };
}
