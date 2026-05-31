import { Room, type Client } from "colyseus";
import { MAX_PLAYERS } from "../../shared/constants.js";
import { createPlayerRecord } from "../logic/playerSlots.js";
import {
  normalizeMoveMessage,
  validateAndClampMove
} from "../logic/movement.js";
import { GameState } from "./schema/GameState.js";
import { createPlayerState } from "./schema/PlayerState.js";

type PingMessage = {
  clientTime?: unknown;
};

type PongMessage = {
  clientTime: number;
  serverTime: number;
};

export class GameRoom extends Room<{ state: GameState }> {
  maxClients = MAX_PLAYERS;

  onCreate(): void {
    this.setState(new GameState());

    this.onMessage("move", (client, message: unknown) => {
      this.handleMove(client.sessionId, message);
    });

    this.onMessage("ping", (client, message: PingMessage) => {
      const pong = this.createPong(message);

      if (pong) {
        client.send("pong", pong);
      }
    });
  }

  onJoin(client: Client): void {
    if (this.state.players.size >= MAX_PLAYERS) {
      throw new Error("ROOM_FULL");
    }

    const slotIndex = this.state.players.size;
    const record = createPlayerRecord(client.sessionId, slotIndex, Date.now());

    this.state.players.set(client.sessionId, createPlayerState(record));
  }

  onLeave(client: Client): void {
    this.state.players.delete(client.sessionId);
    this.broadcast("playerLeft", { sessionId: client.sessionId });
  }

  handleMoveForTest(sessionId: string, message: unknown): void {
    this.handleMove(sessionId, message);
  }

  createPongForTest(message: PingMessage): PongMessage {
    const pong = this.createPong(message);

    if (!pong) {
      throw new Error("INVALID_PING");
    }

    return pong;
  }

  private createPong(message: PingMessage): PongMessage | null {
    if (typeof message.clientTime !== "number" || !Number.isFinite(message.clientTime)) {
      return null;
    }

    return {
      clientTime: message.clientTime,
      serverTime: Date.now()
    };
  }

  private handleMove(sessionId: string, message: unknown): void {
    const player = this.state.players.get(sessionId);

    if (!player) {
      return;
    }

    const move = normalizeMoveMessage(message);

    if (!move) {
      return;
    }

    const result = validateAndClampMove(
      {
        sessionId: player.sessionId,
        name: player.name,
        x: player.x,
        y: player.y,
        z: player.z,
        rotationY: player.rotationY,
        pitch: player.pitch,
        color: player.color,
        lastMoveAt: player.lastMoveAt
      },
      move,
      Date.now()
    );

    if (!result.accepted) {
      return;
    }

    player.x = result.x;
    player.y = result.y;
    player.z = result.z;
    player.rotationY = result.rotationY;
    player.pitch = result.pitch;
    player.lastMoveAt = Date.now();
  }
}
