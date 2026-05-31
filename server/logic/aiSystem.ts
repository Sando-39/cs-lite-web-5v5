import { AI_MAX_HP, AI_MOVE_SPEED_UNITS_PER_SECOND, PLAYER_MIN_HP } from "../../shared/constants.js";
import type { AiStateKind, AiWaypoint } from "../../shared/aiEnemies.js";

export type AiPatrolInput = { x: number; z: number; patrolIndex: number };
export type AiPatrolResult = { x: number; z: number; patrolIndex: number; rotationY: number };
export type AiVisionInput = { x: number; z: number; rotationY: number };
export type PlayerVisionInput = { sessionId: string; x: number; z: number };
export type AiRespawnInput = { hp: number; alive: boolean; state: AiStateKind; respawnAt: number; spawnX: number; spawnZ: number };
export type AiRespawnResult = { hp: number; alive: boolean; state: AiStateKind; x: number; z: number; respawnAt: number; respawned: boolean };

export function updateAiPatrolPosition(ai: AiPatrolInput, waypoints: readonly AiWaypoint[], speed = AI_MOVE_SPEED_UNITS_PER_SECOND, deltaSeconds: number): AiPatrolResult {
  const nextIndex = (ai.patrolIndex + 1) % waypoints.length;
  const target = waypoints[nextIndex];
  const dx = target.x - ai.x, dz = target.z - ai.z;
  const distance = Math.sqrt(dx * dx + dz * dz);
  if (distance < 0.2) return { x: target.x, z: target.z, patrolIndex: nextIndex, rotationY: Math.atan2(dx, dz) };
  const step = Math.min(distance, speed * deltaSeconds);
  return { x: ai.x + (dx / distance) * step, z: ai.z + (dz / distance) * step, patrolIndex: ai.patrolIndex, rotationY: Math.atan2(dx, dz) };
}

export function chooseNearestVisiblePlayer(ai: AiVisionInput, players: readonly PlayerVisionInput[], detectionRange: number, fieldOfViewDegrees: number): PlayerVisionInput | null {
  let best: PlayerVisionInput | null = null;
  let bestDistance = Infinity;
  const halfFov = (fieldOfViewDegrees * Math.PI) / 180 / 2;
  for (const p of players) {
    const dx = p.x - ai.x, dz = p.z - ai.z;
    const dist = Math.sqrt(dx * dx + dz * dz);
    if (dist > detectionRange) continue;
    const angleToPlayer = Math.atan2(dx, dz);
    const delta = Math.abs(normalizeAngle(angleToPlayer - ai.rotationY));
    if (delta > halfFov) continue;
    if (dist < bestDistance) { best = p; bestDistance = dist; }
  }
  return best;
}

export function damagePlayerWithoutKilling(currentHp: number, damage: number): number {
  return Math.max(PLAYER_MIN_HP, currentHp - damage);
}

export function respawnAiIfReady(ai: AiRespawnInput, now: number): AiRespawnResult {
  if (ai.alive || ai.respawnAt === 0 || now < ai.respawnAt) return { hp: ai.hp, alive: ai.alive, state: ai.state, x: ai.spawnX, z: ai.spawnZ, respawnAt: ai.respawnAt, respawned: false };
  return { hp: AI_MAX_HP, alive: true, state: "patrol", x: ai.spawnX, z: ai.spawnZ, respawnAt: 0, respawned: true };
}

function normalizeAngle(angle: number): number {
  let r = angle;
  while (r > Math.PI) r -= Math.PI * 2;
  while (r < -Math.PI) r += Math.PI * 2;
  return r;
}
