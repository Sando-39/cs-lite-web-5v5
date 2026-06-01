import { describe, expect, it } from "vitest";
import { AudioEventThrottle } from "../../src/game/GameAudio";

describe("AudioEventThrottle", () => {
  it("allows first event", () => { expect(new AudioEventThrottle().canPlay("x", 0, 150)).toBe(true); });
  it("blocks repeated events inside interval", () => {
    const t = new AudioEventThrottle();
    expect(t.canPlay("x", 0, 150)).toBe(true);
    expect(t.canPlay("x", 100, 150)).toBe(false);
  });
  it("allows after interval", () => {
    const t = new AudioEventThrottle();
    expect(t.canPlay("x", 0, 150)).toBe(true);
    expect(t.canPlay("x", 151, 150)).toBe(true);
  });
});
