import { describe, expect, it } from "vitest";
import type { Client } from "colyseus";
import { GameRoom } from "../../server/rooms/GameRoom";

function makeClient(sessionId: string): Client {
  return {
    sessionId,
    send: () => undefined
  } as unknown as Client;
}

function makeClientWithMessages(sessionId: string): Client {
  return {
    sessionId,
    sent: [],
    send(type: string, message: unknown) {
      (this as unknown as { sent: Array<{ type: string; message: unknown }> }).sent.push({ type, message });
    }
  } as unknown as Client;
}

describe("GameRoom", () => {
  it("adds players on join", () => {
    const room = new GameRoom();
    room.onCreate();

    room.onJoin(makeClient("a"));
    room.onJoin(makeClient("b"));

    expect(room.state.players.size).toBe(2);
    expect(room.state.players.get("a")?.name).toBe("Player 1");
    expect(room.state.players.get("b")?.name).toBe("Player 2");
  });

  it("rejects a third player", () => {
    const room = new GameRoom();
    room.onCreate();

    room.onJoin(makeClient("a"));
    room.onJoin(makeClient("b"));

    expect(() => room.onJoin(makeClient("c"))).toThrow("ROOM_FULL");
  });

  it("removes players on leave", () => {
    const room = new GameRoom();
    room.onCreate();

    room.onJoin(makeClient("a"));
    room.onLeave(makeClient("a"));

    expect(room.state.players.has("a")).toBe(false);
  });

  it("updates player position from a valid move message", () => {
    const room = new GameRoom();
    room.onCreate();

    room.onJoin(makeClient("a"));

    // Advance lastMoveAt so the speed limiter allows the move
    const player = room.state.players.get("a");
    if (player) {
      player.lastMoveAt = Date.now() - 5000;
    }

    room.handleMoveForTest("a", {
      x: -3.8,
      y: 1.7,
      z: 0.2,
      rotationY: 0.3,
      pitch: 0.1
    });

    const moved = room.state.players.get("a");

    expect(moved?.x).toBeCloseTo(-3.8);
    expect(moved?.z).toBeCloseTo(0.2);
    expect(moved?.rotationY).toBeCloseTo(0.3);
    expect(moved?.pitch).toBeCloseTo(0.1);
  });

  it("ignores malformed move messages", () => {
    const room = new GameRoom();
    room.onCreate();

    room.onJoin(makeClient("a"));

    const before = room.state.players.get("a")?.x;
    room.handleMoveForTest("a", {
      x: "bad",
      y: 1.7,
      z: 0,
      rotationY: 0,
      pitch: 0
    });

    expect(room.state.players.get("a")?.x).toBe(before);
  });

  it("does not initialize static targets in v0.4", () => {
    const room = new GameRoom();
    room.onCreate();
    expect(room.state.targets.size).toBe(0);
  });

  it("creates a pong payload from a ping payload", () => {
    const room = new GameRoom();
    const pong = room.createPongForTest({ clientTime: 123 });

    expect(pong.clientTime).toBe(123);
    expect(typeof pong.serverTime).toBe("number");
  });

  it("initializes player hp and active weapon on join", () => {
    const room = new GameRoom();
    room.onCreate();
    room.onJoin(makeClient("a"));
    const player = room.state.players.get("a");
    expect(player?.hp).toBe(100);
    expect(player?.maxHp).toBe(100);
    expect(player?.activeWeaponId).toBe("ar4");
  });

  it("initializes three patrol AI enemies", () => {
    const room = new GameRoom();
    room.onCreate();
    expect(room.state.aiEnemies.size).toBe(3);
    expect(room.state.aiEnemies.get("ai-1")?.state).toBe("patrol");
    expect(room.state.aiEnemies.get("ai-1")?.hp).toBe(100);
  });

  it("switches active weapon from AR-4 to R-47", () => {
    const room = new GameRoom();
    room.onCreate();
    room.onJoin(makeClient("a"));
    room.handleSwitchWeaponForTest("a", { weaponId: "r47", clientTime: 1000 });
    expect(room.state.players.get("a")?.activeWeaponId).toBe("r47");
  });

  it("fires active weapon and consumes ammo", () => {
    const room = new GameRoom();
    room.onCreate();
    room.onJoin(makeClient("a"));
    const result = room.handleWeaponFireForTest("a", { weaponId: "ar4", clientTime: 1000 }, 1000);
    expect(result?.accepted).toBe(true);
    expect(room.state.players.get("a")?.weapons.get("ar4")?.ammoInMag).toBe(29);
  });

  it("starts reload for a partially empty magazine", () => {
    const room = new GameRoom();
    room.onCreate();
    room.onJoin(makeClient("a"));
    const weapon = room.state.players.get("a")?.weapons.get("ar4");
    weapon!.ammoInMag = 10;
    const result = room.handleReloadForTest("a", { weaponId: "ar4", clientTime: 1000 }, 1000);
    expect(result?.started).toBe(true);
    expect(weapon?.isReloading).toBe(true);
  });

  it("updates player hp when damaged by ai but does not kill", () => {
    const room = new GameRoom();
    room.onCreate();
    room.onJoin(makeClient("a"));
    room.damagePlayerForTest("a", "ai-1", 200);
    expect(room.state.players.get("a")?.hp).toBe(1);
  });

  it("regenerates player hp after regen delay", () => {
    const room = new GameRoom();
    room.onCreate();
    room.onJoin(makeClient("a"));
    const player = room.state.players.get("a")!;
    player.hp = 50;
    player.lastDamagedAt = 1000;
    room.regeneratePlayersForTest(5000, 1);
    expect(player.hp).toBe(60);
  });

  it("rejects empty mag weapon fire and does not damage AI", () => {
    const room = new GameRoom();
    room.onCreate();
    room.onJoin(makeClient("a"));
    const weapon = room.state.players.get("a")?.weapons.get("ar4");
    weapon!.ammoInMag = 0;
    const result = room.handleWeaponFireForTest("a", { weaponId: "ar4", clientTime: 1000 }, 1000);
    expect(result?.accepted).toBe(false);
    expect(result?.reason).toBe("empty_mag");
    // AI should still be at 100 HP
    expect(room.state.aiEnemies.get("ai-1")?.hp).toBe(100);
  });

  it("fires and damages AI after reload completes", () => {
    const room = new GameRoom();
    room.onCreate();
    room.onJoin(makeClient("a"));
    const weapon = room.state.players.get("a")?.weapons.get("ar4");
    weapon!.ammoInMag = 2;
    // Start reload
    room.handleReloadForTest("a", { weaponId: "ar4", clientTime: 1000 }, 1000);
    // Reload completes at 2900
    const playerState = room.state.players.get("a")!;
    // Simulate simulation completing the reload
    playerState.weapons.get("ar4")!.ammoInMag = 30;
    playerState.weapons.get("ar4")!.reserveAmmo = 62;
    playerState.weapons.get("ar4")!.isReloading = false;
    playerState.weapons.get("ar4")!.reloadEndsAt = 0;
    // Position player to hit AI
    const ai = room.state.aiEnemies.get("ai-1")!;
    playerState.x = ai.x; playerState.y = 1.7; playerState.z = ai.z + 20;
    playerState.rotationY = Math.PI; playerState.pitch = 0;
    // Fire
    const result = room.handleWeaponFireForTest("a", { weaponId: "ar4", clientTime: 3000 }, 3000);
    expect(result?.accepted).toBe(true);
    expect(result?.hit).toBe(true);
    expect(result?.damage).toBe(24);
    expect(ai.hp).toBe(76);
  });
});
