import { Color3, Mesh, MeshBuilder, Scene, StandardMaterial } from "@babylonjs/core";
import type { TargetSnapshot } from "../../shared/types";

type TargetRenderState = { body: Mesh; material: StandardMaterial; hpLabel: HTMLDivElement };

export class TargetView {
  private scene: Scene;
  private overlayRoot: HTMLElement;
  private targets = new Map<string, TargetRenderState>();

  constructor(scene: Scene, overlayRoot: HTMLElement) {
    this.scene = scene;
    this.overlayRoot = overlayRoot;
  }

  update(targets: TargetSnapshot[]): void {
    const ids = new Set(targets.map((t) => t.id));
    for (const target of targets) {
      let state = this.targets.get(target.id);
      if (!state) {
        state = this.createTarget(target);
        this.targets.set(target.id, state);
      }
      state.body.position.set(target.x, target.y + target.height / 2, target.z);
      state.body.scaling.y = target.alive ? 1 : 0.35;
      state.material.diffuseColor = target.alive ? new Color3(0.95, 0.22, 0.18) : new Color3(0.35, 0.35, 0.35);
      state.hpLabel.textContent = `${target.name}: ${target.hp}/${target.maxHp}`;
      state.hpLabel.classList.toggle("target-dead", !target.alive);
    }
    for (const [targetId, state] of this.targets.entries()) {
      if (!ids.has(targetId)) { state.body.dispose(); state.hpLabel.remove(); this.targets.delete(targetId); }
    }
  }

  dispose(): void {
    for (const state of this.targets.values()) { state.body.dispose(); state.hpLabel.remove(); }
    this.targets.clear();
  }

  private createTarget(target: TargetSnapshot): TargetRenderState {
    const body = MeshBuilder.CreateBox(`static-target-${target.id}`, { width: target.radius * 2, height: target.height, depth: target.radius * 2 }, this.scene);
    const material = new StandardMaterial(`static-target-material-${target.id}`, this.scene);
    material.diffuseColor = new Color3(0.95, 0.22, 0.18);
    body.material = material;
    body.position.set(target.x, target.y + target.height / 2, target.z);
    const hpLabel = document.createElement("div");
    hpLabel.className = "target-hp";
    hpLabel.textContent = `${target.name}: ${target.hp}/${target.maxHp}`;
    this.overlayRoot.appendChild(hpLabel);
    return { body, material, hpLabel };
  }
}
