import { describe, expect, it } from "vitest";
import {
  applyTargetDamage,
  createShotRay,
  intersectRayWithAiEnemy,
  intersectRayWithStaticTarget,
  respawnTargetIfReady
} from "../../server/logic/combat";
import {
  RIFLE_DAMAGE,
  TARGET_MAX_HP,
  TARGET_RESPAWN_DELAY_MS
} from "../../shared/constants";

const target = {
  id: "target-1", name: "Training Dummy",
  x: 0, y: 0, z: 10, radius: 0.6, height: 1.8,
  hp: TARGET_MAX_HP, maxHp: TARGET_MAX_HP, alive: true, respawnAt: 0
};

describe("combat", () => {
  it("creates a forward shot ray when yaw and pitch are zero", () => {
    const ray = createShotRay({ x: 0, y: 1.7, z: 0, rotationY: 0, pitch: 0 });
    expect(ray.origin).toEqual({ x: 0, y: 1.7, z: 0 });
    expect(ray.direction.x).toBeCloseTo(0);
    expect(ray.direction.y).toBeCloseTo(0);
    expect(ray.direction.z).toBeCloseTo(1);
  });

  it("creates a right-facing shot ray at yaw PI over 2", () => {
    const ray = createShotRay({ x: 0, y: 1.7, z: 0, rotationY: Math.PI / 2, pitch: 0 });
    expect(ray.direction.x).toBeCloseTo(1);
    expect(ray.direction.z).toBeCloseTo(0);
  });

  it("includes pitch in the vertical ray direction", () => {
    const ray = createShotRay({ x: 0, y: 1.7, z: 0, rotationY: 0, pitch: 0.3 });
    expect(ray.direction.y).toBeLessThan(0);
  });

  it("hits a target directly in front of the player", () => {
    const ray = createShotRay({ x: 0, y: 1.0, z: 0, rotationY: 0, pitch: 0 });
    const hit = intersectRayWithStaticTarget(ray, target);
    expect(hit).not.toBeNull();
    expect(hit?.targetId).toBe("target-1");
  });

  it("misses when the ray points away from the target", () => {
    const ray = createShotRay({ x: 0, y: 1.0, z: 0, rotationY: Math.PI, pitch: 0 });
    expect(intersectRayWithStaticTarget(ray, target)).toBeNull();
  });

  it("misses when the target is outside range", () => {
    const ray = createShotRay({ x: 0, y: 1.0, z: 0, rotationY: 0, pitch: 0 });
    expect(intersectRayWithStaticTarget(ray, { ...target, z: 1000 })).toBeNull();
  });

  it("applies damage without killing a healthy target", () => {
    const result = applyTargetDamage({ ...target, hp: 100, alive: true, respawnAt: 0 }, RIFLE_DAMAGE, 1000);
    expect(result.hp).toBe(75);
    expect(result.alive).toBe(true);
    expect(result.killed).toBe(false);
    expect(result.respawnAt).toBe(0);
  });

  it("kills a target at zero HP and sets respawnAt", () => {
    const result = applyTargetDamage({ ...target, hp: 25, alive: true, respawnAt: 0 }, RIFLE_DAMAGE, 1000);
    expect(result.hp).toBe(0);
    expect(result.alive).toBe(false);
    expect(result.killed).toBe(true);
    expect(result.respawnAt).toBe(1000 + TARGET_RESPAWN_DELAY_MS);
  });

  it("does not damage a dead target", () => {
    const result = applyTargetDamage({ ...target, hp: 0, alive: false, respawnAt: 4000 }, RIFLE_DAMAGE, 1000);
    expect(result.hp).toBe(0);
    expect(result.alive).toBe(false);
    expect(result.killed).toBe(false);
    expect(result.wasAlreadyDead).toBe(true);
  });

  it("respawns a target when respawn time is reached", () => {
    const result = respawnTargetIfReady({ ...target, hp: 0, alive: false, respawnAt: 4000 }, 4000);
    expect(result.hp).toBe(100);
    expect(result.alive).toBe(true);
    expect(result.respawnAt).toBe(0);
    expect(result.respawned).toBe(true);
  });

  it("hits an AI target directly in front of the player", () => {
    const ray = createShotRay({ x: 0, y: 1.7, z: 0, rotationY: 0, pitch: 0 });
    const hit = intersectRayWithAiEnemy(ray, { id: "ai-1", x: 0, y: 1.7, z: 10, radius: 0.5, height: 1.8, alive: true }, 70);
    expect(hit?.targetId).toBe("ai-1");
  });

  it("does not hit a dead AI target", () => {
    const ray = createShotRay({ x: 0, y: 1.7, z: 0, rotationY: 0, pitch: 0 });
    expect(intersectRayWithAiEnemy(ray, { id: "ai-1", x: 0, y: 1.7, z: 10, radius: 0.5, height: 1.8, alive: false }, 70)).toBeNull();
  });
});
