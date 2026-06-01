import { describe, expect, it } from "vitest";
import {
  clampToMapBounds,
  normalizeMoveMessage,
  validateAndClampMove
} from "../../server/logic/movement";
import { MAP_HALF_SIZE } from "../../shared/constants";
import type { ServerPlayerRecord } from "../../shared/types";

function makePlayer(overrides: Partial<ServerPlayerRecord> = {}): ServerPlayerRecord {
  return {
    sessionId: "a",
    name: "Player 1",
    x: 0,
    y: 1.7,
    z: 0,
    rotationY: 0,
    pitch: 0,
    color: "blue",
    lastMoveAt: 1000,
    hp: 100,
    maxHp: 100,
    lastDamagedAt: 0,
    activeWeaponId: "ar4",
    ...overrides
  };
}

describe("movement rules", () => {
  it("normalizes a valid move message", () => {
    const result = normalizeMoveMessage({
      x: 1,
      y: 1.7,
      z: -2,
      rotationY: 0.5,
      pitch: 0.2
    });

    expect(result).toEqual({
      x: 1,
      y: 1.7,
      z: -2,
      rotationY: 0.5,
      pitch: 0.2
    });
  });

  it("rejects missing or non-finite movement fields", () => {
    expect(normalizeMoveMessage({ x: 1, y: 2, z: 3 })).toBeNull();
    expect(
      normalizeMoveMessage({
        x: Number.POSITIVE_INFINITY,
        y: 1.7,
        z: 0,
        rotationY: 0,
        pitch: 0
      })
    ).toBeNull();
  });

  it("clamps positions to map bounds", () => {
    expect(clampToMapBounds(MAP_HALF_SIZE + 99)).toBe(MAP_HALF_SIZE);
    expect(clampToMapBounds(-MAP_HALF_SIZE - 99)).toBe(-MAP_HALF_SIZE);
    expect(clampToMapBounds(4)).toBe(4);
  });

  it("accepts reasonable movement", () => {
    const player = makePlayer();
    const result = validateAndClampMove(
      player,
      {
        x: 0.5,
        y: 1.7,
        z: 0,
        rotationY: 0.1,
        pitch: 0
      },
      1100
    );

    expect(result.accepted).toBe(true);
    expect(result.x).toBeCloseTo(0.5);
    expect(result.z).toBeCloseTo(0);
    expect(result.rotationY).toBeCloseTo(0.1);
    expect(result.pitch).toBeCloseTo(0);
  });

  it("clamps obvious teleport movement instead of accepting the target directly", () => {
    const player = makePlayer();
    const result = validateAndClampMove(
      player,
      {
        x: 100,
        y: 1.7,
        z: 0,
        rotationY: 0,
        pitch: 0
      },
      1100
    );

    expect(result.accepted).toBe(true);
    expect(result.x).toBeLessThan(2);
    expect(result.x).toBeGreaterThan(0);
    expect(result.z).toBe(0);
  });

  it("does not accept a final position inside a map collider", () => {
    const player = makePlayer({ x: -8, z: -10, lastMoveAt: 1000 });
    const result = validateAndClampMove(
      player,
      {
        x: -8,
        y: 1.7,
        z: -6,
        rotationY: 0,
        pitch: 0
      },
      1500
    );

    expect(result.accepted).toBe(true);
    expect(result.x).toBeCloseTo(-8);
    expect(result.z).not.toBeCloseTo(-6);
  });

  it("keeps the final server position inside map bounds", () => {
    const player = makePlayer({ x: 23, z: 0, lastMoveAt: 1000 });
    const result = validateAndClampMove(
      player,
      {
        x: 999,
        y: 1.7,
        z: 0,
        rotationY: 0,
        pitch: 0
      },
      1500
    );

    expect(result.accepted).toBe(true);
    expect(result.x).toBeLessThanOrEqual(23.55);
  });

  it("applies speed limits before collision resolution", () => {
    const player = makePlayer({ x: -12, z: -12, lastMoveAt: 1000 });
    const result = validateAndClampMove(
      player,
      {
        x: 12,
        y: 1.7,
        z: 12,
        rotationY: 0,
        pitch: 0
      },
      1100
    );

    const dx = result.x - player.x;
    const dz = result.z - player.z;
    const moved = Math.sqrt(dx * dx + dz * dz);

    expect(result.accepted).toBe(true);
    expect(moved).toBeLessThan(2);
  });

  it("rejects movement without pitch", () => {
    expect(normalizeMoveMessage({ x: 1, y: 1.7, z: -2, rotationY: 0.5 })).toBeNull();
  });

  it("clamps pitch to the allowed range", () => {
    const player = makePlayer();
    const result = validateAndClampMove(player, { x: 0, y: 1.7, z: 0, rotationY: 0, pitch: 999 }, 1100);
    expect(result.pitch).toBe(1.35);
  });
});
