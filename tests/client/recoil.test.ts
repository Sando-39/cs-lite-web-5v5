import { describe, expect, it } from "vitest";
import { applyRecoilImpulse } from "../../src/game/WeaponView";

describe("weapon recoil helpers", () => {
  it("adds recoil impulse in upward direction", () => {
    // Firing should pitch UP (more negative = looking up)
    const result = applyRecoilImpulse({ pitch: 0, yaw: 0 }, { vertical: 0.02, horizontal: 0.01 }, 1);
    expect(result.pitch).toBeLessThan(0); // negative = upward kick
  });

  it("does not pull aim back automatically", () => {
    // Recoil offset persists — no recovery function applied to real recoil
    const afterFire = applyRecoilImpulse({ pitch: -0.1, yaw: 0.03 }, { vertical: 0.02, horizontal: 0.01 }, 1);
    // pitch stays negative (upward+more upward), not recovering toward 0
    expect(afterFire.pitch).toBeLessThan(-0.1);
  });
});
