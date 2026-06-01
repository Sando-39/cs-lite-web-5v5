import { describe, expect, it } from "vitest";
import { HudUpdateGate } from "../../src/game/HudUpdateGate";

describe("HudUpdateGate", () => {
  it("allows the first update", () => { expect(new HudUpdateGate<string>(200, (a, b) => a === b).shouldUpdate("a", 0)).toBe(true); });
  it("blocks identical updates inside interval", () => {
    const gate = new HudUpdateGate<string>(200, (a, b) => a === b);
    expect(gate.shouldUpdate("a", 0)).toBe(true);
    expect(gate.shouldUpdate("a", 50)).toBe(false);
  });
  it("allows changed values immediately", () => {
    const gate = new HudUpdateGate<string>(200, (a, b) => a === b);
    expect(gate.shouldUpdate("a", 0)).toBe(true);
    expect(gate.shouldUpdate("b", 50)).toBe(true);
  });
  it("allows same value after interval", () => {
    const gate = new HudUpdateGate<string>(200, (a, b) => a === b);
    expect(gate.shouldUpdate("a", 0)).toBe(true);
    expect(gate.shouldUpdate("a", 250)).toBe(true);
  });
});
