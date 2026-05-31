import { RIFLE_RANGE_UNITS, TARGET_RESPAWN_DELAY_MS } from "../../shared/constants.js";

export type Vector3Like = { x: number; y: number; z: number };
export type ShotRay = { origin: Vector3Like; direction: Vector3Like };
export type ShooterPose = { x: number; y: number; z: number; rotationY: number; pitch: number };
export type StaticTargetLike = { id: string; name: string; x: number; y: number; z: number; radius: number; height: number };
export type TargetCombatState = StaticTargetLike & { hp: number; maxHp: number; alive: boolean; respawnAt: number };
export type TargetHit = { targetId: string; distance: number };
export type DamageResult = { hp: number; alive: boolean; killed: boolean; respawnAt: number; wasAlreadyDead: boolean };
export type RespawnResult = { hp: number; alive: boolean; respawnAt: number; respawned: boolean };

export function createShotRay(player: ShooterPose): ShotRay {
  const cosPitch = Math.cos(player.pitch);
  const direction = normalizeVector({
    x: Math.sin(player.rotationY) * cosPitch,
    y: -Math.sin(player.pitch),
    z: Math.cos(player.rotationY) * cosPitch
  });
  return { origin: { x: player.x, y: player.y, z: player.z }, direction };
}

export function intersectRayWithStaticTarget(ray: ShotRay, target: StaticTargetLike, range = RIFLE_RANGE_UNITS): TargetHit | null {
  const targetCenterY = target.y + target.height / 2;
  const targetCenter = { x: target.x, y: targetCenterY, z: target.z };
  const toTarget = { x: targetCenter.x - ray.origin.x, y: targetCenter.y - ray.origin.y, z: targetCenter.z - ray.origin.z };
  const projection = toTarget.x * ray.direction.x + toTarget.y * ray.direction.y + toTarget.z * ray.direction.z;
  if (projection < 0 || projection > range) return null;
  const closest = { x: ray.origin.x + ray.direction.x * projection, y: ray.origin.y + ray.direction.y * projection, z: ray.origin.z + ray.direction.z * projection };
  if (closest.y < target.y || closest.y > target.y + target.height) return null;
  const horizontalDx = closest.x - target.x;
  const horizontalDz = closest.z - target.z;
  if (Math.sqrt(horizontalDx * horizontalDx + horizontalDz * horizontalDz) > target.radius) return null;
  return { targetId: target.id, distance: projection };
}

export function applyTargetDamage(target: TargetCombatState, damage: number, now: number): DamageResult {
  if (!target.alive) return { hp: target.hp, alive: false, killed: false, respawnAt: target.respawnAt, wasAlreadyDead: true };
  const nextHp = Math.max(0, target.hp - damage);
  const killed = nextHp === 0;
  return { hp: nextHp, alive: !killed, killed, respawnAt: killed ? now + TARGET_RESPAWN_DELAY_MS : target.respawnAt, wasAlreadyDead: false };
}

export function respawnTargetIfReady(target: TargetCombatState, now: number): RespawnResult {
  if (target.alive || target.respawnAt === 0 || now < target.respawnAt) return { hp: target.hp, alive: target.alive, respawnAt: target.respawnAt, respawned: false };
  return { hp: target.maxHp, alive: true, respawnAt: 0, respawned: true };
}

function normalizeVector(vector: Vector3Like): Vector3Like {
  const length = Math.sqrt(vector.x * vector.x + vector.y * vector.y + vector.z * vector.z);
  if (length === 0) return { x: 0, y: 0, z: 1 };
  return { x: vector.x / length, y: vector.y / length, z: vector.z / length };
}
