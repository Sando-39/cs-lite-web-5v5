import {
  Color3,
  Mesh,
  MeshBuilder,
  Scene,
  StandardMaterial
} from "@babylonjs/core";
import type { ClientPlayerSnapshot } from "../../shared/types";

export class RemotePlayerView {
  private scene: Scene;
  private meshes = new Map<string, Mesh>();

  constructor(scene: Scene) {
    this.scene = scene;
  }

  update(players: ClientPlayerSnapshot[], localSessionId: string | null): void {
    const remotePlayers = players.filter(
      (player) => player.sessionId !== localSessionId
    );
    const remoteIds = new Set(remotePlayers.map((player) => player.sessionId));

    for (const player of remotePlayers) {
      let mesh = this.meshes.get(player.sessionId);

      if (!mesh) {
        mesh = this.createMesh(player);
        this.meshes.set(player.sessionId, mesh);
      }

      mesh.position.set(player.x, player.y - 0.85, player.z);
      mesh.rotation.y = player.rotationY;
    }

    for (const [sessionId, mesh] of this.meshes.entries()) {
      if (!remoteIds.has(sessionId)) {
        mesh.dispose();
        this.meshes.delete(sessionId);
      }
    }
  }

  dispose(): void {
    for (const mesh of this.meshes.values()) {
      mesh.dispose();
    }

    this.meshes.clear();
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
