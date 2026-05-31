import { describe, expect, it } from "vitest";
import { MAX_PLAYERS } from "../../shared/constants";
import {
  canAcceptPlayer,
  createPlayerRecord,
  getColorForSlot,
  getSpawnForSlot
} from "../../server/logic/playerSlots";

describe("player slots", () => {
  it("allows the first two players and rejects the third", () => {
    expect(canAcceptPlayer(0)).toBe(true);
    expect(canAcceptPlayer(1)).toBe(true);
    expect(canAcceptPlayer(MAX_PLAYERS)).toBe(false);
  });

  it("assigns different colors to the two slots", () => {
    expect(getColorForSlot(0)).toBe("blue");
    expect(getColorForSlot(1)).toBe("orange");
  });

  it("assigns different spawn positions to the two slots", () => {
    const first = getSpawnForSlot(0);
    const second = getSpawnForSlot(1);

    expect(first.x).not.toBe(second.x);
    expect(first.x !== second.x || first.z !== second.z).toBe(true);
  });

  it("creates a full server player record", () => {
    const player = createPlayerRecord("abc", 0, 1234);

    expect(player).toEqual({
      sessionId: "abc",
      name: "Player 1",
      x: -4,
      y: 1.7,
      z: 0,
      rotationY: Math.PI / 2,
      pitch: 0,
      color: "blue",
      lastMoveAt: 1234,
      hp: 100, maxHp: 100, lastDamagedAt: 0, activeWeaponId: "ar4"
    });
  });
});
