import { Room, type Client } from "colyseus";
import { MAX_PLAYERS } from "../../shared/constants";
import { createPlayerRecord } from "../logic/playerSlots";
import {
  normalizeMoveMessage,
  validateAndClampMove
} from "../logic/movement";
import { GameState } from "./schema/GameState";
import { createPlayerState } from "./schema/PlayerState";

export class GameRoom extends Room<GameState> {
  maxClients = MAX_PLAYERS;

  onCreate(): void {
    this.setState(new GameState());

    this.onMessage("move", (client, message: unknown) => {
      this.handleMove(client.sessionId, message);
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
    player.lastMoveAt = Date.now();
  }
}
