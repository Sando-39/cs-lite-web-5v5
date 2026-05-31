import { describe, expect, it } from "vitest";
import { applyRecoilImpulse, recoverVisualRecoil } from "../../src/game/WeaponView";

describe("visual recoil helpers", () => {
  it("adds recoil impulse as visual punch", () => {
    const result = applyRecoilImpulse({ pitchPunch: 0, yawPunch: 0 }, { pitch: 0.01, yaw: 0.005 });
    // pitchPunch should be positive (pushing aim upward)
    expect(result.pitchPunch).toBeGreaterThan(0);
    expect(result.yawPunch).toBe(0.005);
  });

  it("recovers visual recoil back toward zero", () => {
    const result = recoverVisualRecoil({ pitchPunch: 0.05, yawPunch: 0.03 }, 0.01);
    expect(result.pitchPunch).toBeLessThan(0.05);
    expect(result.yawPunch).toBeLessThan(0.03);
  });

  it("recovers to exactly zero when amount exceeds remaining", () => {
    const result = recoverVisualRecoil({ pitchPunch: 0.002, yawPunch: 0.001 }, 0.005);
    expect(result.pitchPunch).toBe(0);
    expect(result.yawPunch).toBe(0);
  });

  it("does not modify real aim pitch — visual punch only", () => {
    // Real aim pitch stays in InputController, not touched by WeaponView
    const visual = applyRecoilImpulse({ pitchPunch: 0, yawPunch: 0 }, { pitch: 0.02, yaw: 0 });
    // Visual punch propagates but real pitch is stored separately
    expect(visual.pitchPunch).toBe(0.02);
  });
});
