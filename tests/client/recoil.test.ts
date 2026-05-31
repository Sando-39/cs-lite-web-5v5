import { describe, expect, it } from "vitest";
import { applyRecoilImpulse, recoverRecoil } from "../../src/game/WeaponView";

describe("weapon recoil helpers", () => {
  it("adds recoil impulse", () => { expect(applyRecoilImpulse({ pitch: 0, yaw: 0 }, { vertical: 0.02, horizontal: 0.01 }, 1).pitch).toBeGreaterThan(0); });
  it("recovers recoil toward zero", () => { const r = recoverRecoil({ pitch: 0.1, yaw: 0.05 }, 0.05); expect(r.pitch).toBeLessThan(0.1); expect(r.yaw).toBeLessThan(0.05); });
});
