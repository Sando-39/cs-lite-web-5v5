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
    color: "blue",
    lastMoveAt: 1000,
    ...overrides
  };
}

describe("movement rules", () => {
  it("normalizes a valid move message", () => {
    const result = normalizeMoveMessage({
      x: 1,
      y: 1.7,
      z: -2,
      rotationY: 0.5
    });

    expect(result).toEqual({
      x: 1,
      y: 1.7,
      z: -2,
      rotationY: 0.5
    });
  });

  it("rejects missing or non-finite movement fields", () => {
    expect(normalizeMoveMessage({ x: 1, y: 2, z: 3 })).toBeNull();
    expect(
      normalizeMoveMessage({
        x: Number.POSITIVE_INFINITY,
        y: 1.7,
        z: 0,
        rotationY: 0
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
        rotationY: 0.1
      },
      1100
    );

    expect(result.accepted).toBe(true);
    expect(result.x).toBeCloseTo(0.5);
    expect(result.z).toBeCloseTo(0);
    expect(result.rotationY).toBeCloseTo(0.1);
  });

  it("clamps obvious teleport movement instead of accepting the target directly", () => {
    const player = makePlayer();
    const result = validateAndClampMove(
      player,
      {
        x: 100,
        y: 1.7,
        z: 0,
        rotationY: 0
      },
      1100
    );

    expect(result.accepted).toBe(true);
    expect(result.x).toBeLessThan(2);
    expect(result.x).toBeGreaterThan(0);
    expect(result.z).toBe(0);
  });
});
