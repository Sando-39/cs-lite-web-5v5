import { describe, expect, it } from "vitest";
import { MAP_HALF_SIZE, PLAYER_COLLISION_RADIUS } from "../../shared/constants";
import {
  clampPositionToMap,
  collidesWithAnyMapCollider,
  isPointInsideExpandedAabb,
  resolveMapMovement
} from "../../shared/collision";
import { MAP_COLLIDERS } from "../../shared/mapGeometry";

describe("shared collision", () => {
  it("detects a point inside an expanded AABB", () => {
    expect(
      isPointInsideExpandedAabb(
        0,
        0,
        { id: "test", centerX: 0, centerZ: 0, halfX: 1, halfZ: 1 },
        0.45
      )
    ).toBe(true);
  });

  it("detects a point outside an expanded AABB", () => {
    expect(
      isPointInsideExpandedAabb(
        3,
        0,
        { id: "test", centerX: 0, centerZ: 0, halfX: 1, halfZ: 1 },
        0.45
      )
    ).toBe(false);
  });

  it("finds collisions against the shared map colliders", () => {
    const cover = MAP_COLLIDERS.find((collider) => collider.id === "cover-a");
    expect(cover).toBeDefined();
    expect(
      collidesWithAnyMapCollider(cover!.centerX, cover!.centerZ, PLAYER_COLLISION_RADIUS)
    ).toBe(true);
  });

  it("clamps positions to the playable map bounds", () => {
    expect(clampPositionToMap({ x: MAP_HALF_SIZE + 100, z: 0 }).x).toBeLessThanOrEqual(
      MAP_HALF_SIZE - PLAYER_COLLISION_RADIUS
    );
    expect(clampPositionToMap({ x: 0, z: -MAP_HALF_SIZE - 100 }).z).toBeGreaterThanOrEqual(
      -MAP_HALF_SIZE + PLAYER_COLLISION_RADIUS
    );
  });

  it("allows movement in open space", () => {
    const result = resolveMapMovement(
      { x: -12, z: -12 },
      { x: -11, z: -12 },
      PLAYER_COLLISION_RADIUS
    );

    expect(result.collided).toBe(false);
    expect(result.x).toBeCloseTo(-11);
    expect(result.z).toBeCloseTo(-12);
  });

  it("blocks movement into a collider", () => {
    const result = resolveMapMovement(
      { x: -8, z: -10 },
      { x: -8, z: -6 },
      PLAYER_COLLISION_RADIUS
    );

    expect(result.collided).toBe(true);
    expect(collidesWithAnyMapCollider(result.x, result.z, PLAYER_COLLISION_RADIUS)).toBe(false);
  });

  it("slides along a wall when one axis is still valid", () => {
    const result = resolveMapMovement(
      { x: -11, z: -6 },
      { x: -8, z: -5.2 },
      PLAYER_COLLISION_RADIUS
    );

    expect(result.collided).toBe(true);
    expect(result.x).toBeCloseTo(-11);
    expect(result.z).toBeCloseTo(-5.2);
  });
});
