import { describe, expect, it } from "vitest";
import { chooseNearestVisiblePlayer, damagePlayerWithoutKilling, respawnAiIfReady, updateAiPatrolPosition } from "../../server/logic/aiSystem";

describe("aiSystem", () => {
  it("moves AI toward the next waypoint", () => {
    const result = updateAiPatrolPosition({ x: 0, z: 0, patrolIndex: 0 }, [{ x: 0, z: 0 }, { x: 10, z: 0 }], 2, 1);
    expect(result.x).toBeGreaterThan(0);
    expect(result.z).toBeCloseTo(0);
  });

  it("chooses nearest player inside detection range", () => {
    const player = chooseNearestVisiblePlayer({ x: 0, z: 0, rotationY: 0 }, [{ sessionId: "a", x: 0, z: 8 }, { sessionId: "b", x: 0, z: 20 }], 18, 120);
    expect(player?.sessionId).toBe("a");
  });

  it("returns null if no players are in range", () => {
    expect(chooseNearestVisiblePlayer({ x: 0, z: 0, rotationY: 0 }, [{ sessionId: "a", x: 0, z: 50 }], 18, 120)).toBeNull();
  });

  it("damages player but does not reduce below 1 HP", () => {
    expect(damagePlayerWithoutKilling(100, 12)).toBe(88);
    expect(damagePlayerWithoutKilling(5, 12)).toBe(1);
  });

  it("respawns AI when respawn time is reached", () => {
    const result = respawnAiIfReady({ hp: 0, alive: false, state: "respawning", respawnAt: 5000, spawnX: -4, spawnZ: 6 }, 5000);
    expect(result.hp).toBe(100);
    expect(result.alive).toBe(true);
    expect(result.state).toBe("patrol");
    expect(result.x).toBe(-4);
    expect(result.z).toBe(6);
  });
});
