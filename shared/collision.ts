import { MAP_HALF_SIZE, PLAYER_COLLISION_RADIUS } from "./constants.js";
import { MAP_COLLIDERS, type AabbCollider } from "./mapGeometry.js";

export type Point2 = {
  x: number;
  z: number;
};

export type ResolvedMovement = Point2 & {
  collided: boolean;
};

export function isPointInsideExpandedAabb(
  x: number,
  z: number,
  collider: AabbCollider,
  radius: number
): boolean {
  return (
    x >= collider.centerX - collider.halfX - radius &&
    x <= collider.centerX + collider.halfX + radius &&
    z >= collider.centerZ - collider.halfZ - radius &&
    z <= collider.centerZ + collider.halfZ + radius
  );
}

export function collidesWithAnyMapCollider(
  x: number,
  z: number,
  radius = PLAYER_COLLISION_RADIUS
): boolean {
  return MAP_COLLIDERS.some((collider) =>
    isPointInsideExpandedAabb(x, z, collider, radius)
  );
}

export function clampPositionToMap(point: Point2): Point2 {
  const min = -MAP_HALF_SIZE + PLAYER_COLLISION_RADIUS;
  const max = MAP_HALF_SIZE - PLAYER_COLLISION_RADIUS;

  return {
    x: Math.max(min, Math.min(max, point.x)),
    z: Math.max(min, Math.min(max, point.z))
  };
}

function isLegalPosition(point: Point2, radius: number): boolean {
  const clamped = clampPositionToMap(point);

  if (clamped.x !== point.x || clamped.z !== point.z) {
    return false;
  }

  return !collidesWithAnyMapCollider(point.x, point.z, radius);
}

export function resolveMapMovement(
  from: Point2,
  to: Point2,
  radius = PLAYER_COLLISION_RADIUS
): ResolvedMovement {
  const safeFrom = clampPositionToMap(from);
  const clampedTo = clampPositionToMap(to);

  if (isLegalPosition(clampedTo, radius)) {
    return {
      x: clampedTo.x,
      z: clampedTo.z,
      collided: false
    };
  }

  const xOnly = clampPositionToMap({ x: clampedTo.x, z: safeFrom.z });

  if (isLegalPosition(xOnly, radius)) {
    return {
      x: xOnly.x,
      z: xOnly.z,
      collided: true
    };
  }

  const zOnly = clampPositionToMap({ x: safeFrom.x, z: clampedTo.z });

  if (isLegalPosition(zOnly, radius)) {
    return {
      x: zOnly.x,
      z: zOnly.z,
      collided: true
    };
  }

  if (isLegalPosition(safeFrom, radius)) {
    return {
      x: safeFrom.x,
      z: safeFrom.z,
      collided: true
    };
  }

  return findNearestLegalFallback(radius);
}

function findNearestLegalFallback(radius: number): ResolvedMovement {
  const candidates: Point2[] = [
    { x: -4, z: 0 },
    { x: 4, z: 0 },
    { x: 0, z: 0 },
    { x: -12, z: -12 },
    { x: 12, z: 12 }
  ];

  const fallback = candidates.find((candidate) => isLegalPosition(candidate, radius));

  return {
    x: fallback?.x ?? 0,
    z: fallback?.z ?? 0,
    collided: true
  };
}
