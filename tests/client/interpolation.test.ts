import { describe, expect, it } from "vitest";
import { lerpNumber, lerpRotationY, normalizeAngleRadians } from "../../src/game/interpolation";

describe("interpolation utilities", () => {
  it("lerps a number by alpha", () => {
    expect(lerpNumber(0, 10, 0.25)).toBeCloseTo(2.5);
  });

  it("returns start when alpha is 0", () => {
    expect(lerpNumber(3, 10, 0)).toBe(3);
  });

  it("returns target when alpha is 1", () => {
    expect(lerpNumber(3, 10, 1)).toBe(10);
  });

  it("normalizes angles into -PI to PI", () => {
    expect(normalizeAngleRadians(Math.PI * 3)).toBeCloseTo(Math.PI);
    expect(normalizeAngleRadians(-Math.PI * 3)).toBeCloseTo(-Math.PI);
  });

  it("lerps rotation using the shortest angle path", () => {
    const from = Math.PI - 0.1;
    const to = -Math.PI + 0.1;
    const result = lerpRotationY(from, to, 0.5);

    expect(Math.abs(result)).toBeGreaterThan(3.0);
  });
});
