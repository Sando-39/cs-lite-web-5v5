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

  it("initializes the static target on room create", () => {
    const room = new GameRoom();
    room.onCreate();
    const target = room.state.targets.get("target-1");
    expect(target).toBeDefined();
    expect(target?.name).toBe("Training Dummy");
    expect(target?.hp).toBe(100);
    expect(target?.alive).toBe(true);
  });

  it("creates a pong payload from a ping payload", () => {
    const room = new GameRoom();
    const pong = room.createPongForTest({ clientTime: 123 });

    expect(pong.clientTime).toBe(123);
    expect(typeof pong.serverTime).toBe("number");
  });

  it("damages the static target when fire hits", () => {
    const room = new GameRoom();
    room.onCreate();
    const client = makeClientWithMessages("a");
    room.onJoin(client);
    const player = room.state.players.get("a");
    expect(player).toBeDefined();
    player!.x = 0; player!.y = 1.0; player!.z = -20;
    player!.rotationY = 0; player!.pitch = 0;
    room.handleFireForTest("a", { clientTime: 123 });
    const target = room.state.targets.get("target-1");
    expect(target?.hp).toBe(75);
    expect(target?.alive).toBe(true);
  });

  it("does not damage the static target when fire misses", () => {
    const room = new GameRoom();
    room.onCreate();
    const client = makeClientWithMessages("a");
    room.onJoin(client);
    const player = room.state.players.get("a");
    player!.x = 0; player!.y = 1.0; player!.z = -20;
    player!.rotationY = Math.PI; player!.pitch = 0;
    room.handleFireForTest("a", { clientTime: 123 });
    expect(room.state.targets.get("target-1")?.hp).toBe(100);
  });

  it("kills the target after four hits", () => {
    const room = new GameRoom();
    room.onCreate();
    const client = makeClientWithMessages("a");
    room.onJoin(client);
    const player = room.state.players.get("a");
    player!.x = 0; player!.y = 1.0; player!.z = -20;
    player!.rotationY = 0; player!.pitch = 0;
    room.handleFireForTest("a", { clientTime: 1 });
    room.handleFireForTest("a", { clientTime: 2 });
    room.handleFireForTest("a", { clientTime: 3 });
    room.handleFireForTest("a", { clientTime: 4 });
    const target = room.state.targets.get("target-1");
    expect(target?.hp).toBe(0);
    expect(target?.alive).toBe(false);
    expect(target?.respawnAt).toBeGreaterThan(0);
  });

  it("ignores malformed fire messages", () => {
    const room = new GameRoom();
    room.onCreate();
    const client = makeClientWithMessages("a");
    room.onJoin(client);
    room.handleFireForTest("a", { clientTime: "bad" });
    expect(room.state.targets.get("target-1")?.hp).toBe(100);
  });

  it("respawns a dead target when respawn time is reached", () => {
    const room = new GameRoom();
    room.onCreate();
    const target = room.state.targets.get("target-1");
    expect(target).toBeDefined();
    target!.hp = 0; target!.alive = false; target!.respawnAt = 5000;
    room.respawnTargetsIfReady(5000);
    expect(target!.hp).toBe(100);
    expect(target!.alive).toBe(true);
    expect(target!.respawnAt).toBe(0);
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
});
