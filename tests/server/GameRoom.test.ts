import { describe, expect, it } from "vitest";
import type { Client } from "colyseus";
import { GameRoom } from "../../server/rooms/GameRoom";

function makeClient(sessionId: string): Client {
  return {
    sessionId,
    send: () => undefined
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
      rotationY: 0.3
    });

    const moved = room.state.players.get("a");

    expect(moved?.x).toBeCloseTo(-3.8);
    expect(moved?.z).toBeCloseTo(0.2);
    expect(moved?.rotationY).toBeCloseTo(0.3);
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
      rotationY: 0
    });

    expect(room.state.players.get("a")?.x).toBe(before);
  });

  it("creates a pong payload from a ping payload", () => {
    const room = new GameRoom();
    const pong = room.createPongForTest({ clientTime: 123 });

    expect(pong.clientTime).toBe(123);
    expect(typeof pong.serverTime).toBe("number");
  });
});
