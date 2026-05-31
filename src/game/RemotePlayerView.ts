import {
  Color3,
  Mesh,
  MeshBuilder,
  Scene,
  StandardMaterial,
  Vector3
} from "@babylonjs/core";
import {
  REMOTE_POSITION_LERP_ALPHA,
  REMOTE_ROTATION_LERP_ALPHA
} from "../../shared/constants";
import type { ClientPlayerSnapshot } from "../../shared/types";
import { lerpNumber, lerpRotationY } from "./interpolation";

type RemotePlayerRenderState = {
  mesh: Mesh;
  targetPosition: Vector3;
  targetRotationY: number;
  lastSnapshotAt: number;
};

export class RemotePlayerView {
  private scene: Scene;
  private players = new Map<string, RemotePlayerRenderState>();

  constructor(scene: Scene) {
    this.scene = scene;
  }

  updateTargets(players: ClientPlayerSnapshot[], localSessionId: string | null): void {
    const now = performance.now();
    const remotePlayers = players.filter(
      (player) => player.sessionId !== localSessionId
    );
    const remoteIds = new Set(remotePlayers.map((player) => player.sessionId));

    for (const player of remotePlayers) {
      let state = this.players.get(player.sessionId);

      if (!state) {
        const mesh = this.createMesh(player);
        mesh.position.set(player.x, player.y - 0.85, player.z);
        mesh.rotation.y = player.rotationY;

        state = {
          mesh,
          targetPosition: new Vector3(player.x, player.y - 0.85, player.z),
          targetRotationY: player.rotationY,
          lastSnapshotAt: now
        };

        this.players.set(player.sessionId, state);
      }

      state.targetPosition.set(player.x, player.y - 0.85, player.z);
      state.targetRotationY = player.rotationY;
      state.lastSnapshotAt = now;
    }

    for (const [sessionId, state] of this.players.entries()) {
      if (!remoteIds.has(sessionId)) {
        state.mesh.dispose();
        this.players.delete(sessionId);
      }
    }
  }

  render(): void {
    for (const state of this.players.values()) {
      state.mesh.position.x = lerpNumber(
        state.mesh.position.x,
        state.targetPosition.x,
        REMOTE_POSITION_LERP_ALPHA
      );
      state.mesh.position.y = lerpNumber(
        state.mesh.position.y,
        state.targetPosition.y,
        REMOTE_POSITION_LERP_ALPHA
      );
      state.mesh.position.z = lerpNumber(
        state.mesh.position.z,
        state.targetPosition.z,
        REMOTE_POSITION_LERP_ALPHA
      );
      state.mesh.rotation.y = lerpRotationY(
        state.mesh.rotation.y,
        state.targetRotationY,
        REMOTE_ROTATION_LERP_ALPHA
      );
    }
  }

  getRemotePlayerCount(): number {
    return this.players.size;
  }

  getNewestSnapshotAgeMs(): number | null {
    let newest = 0;

    for (const state of this.players.values()) {
      newest = Math.max(newest, state.lastSnapshotAt);
    }

    if (newest === 0) {
      return null;
    }

    return Math.max(0, performance.now() - newest);
  }

  dispose(): void {
    for (const state of this.players.values()) {
      state.mesh.dispose();
    }

    this.players.clear();
  }

  private createMesh(player: ClientPlayerSnapshot): Mesh {
    const body = MeshBuilder.CreateBox(
      `remote-player-${player.sessionId}`,
      {
        width: 0.8,
        height: 1.7,
        depth: 0.8
      },
      this.scene
    );

    const material = new StandardMaterial(
      `remote-player-material-${player.sessionId}`,
      this.scene
    );
    material.diffuseColor =
      player.color === "blue"
        ? new Color3(0.15, 0.45, 1)
        : new Color3(1, 0.45, 0.12);

    body.material = material;

    const nose = MeshBuilder.CreateBox(
      `remote-player-facing-${player.sessionId}`,
      {
        width: 0.25,
        height: 0.25,
        depth: 0.7
      },
      this.scene
    );

    nose.parent = body;
    nose.position.z = 0.55;
    nose.position.y = 0.35;

    const noseMaterial = new StandardMaterial(
      `remote-player-facing-material-${player.sessionId}`,
      this.scene
    );
    noseMaterial.diffuseColor = new Color3(1, 1, 1);
    nose.material = noseMaterial;

    return body;
  }
}
