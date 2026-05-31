import { Color3, Mesh, MeshBuilder, Scene, StandardMaterial } from "@babylonjs/core";

export type AiEnemySnapshot = { id: string; name: string; x: number; y: number; z: number; rotationY: number; hp: number; maxHp: number; alive: boolean; state: string };

type AiRenderState = { mesh: Mesh; material: StandardMaterial; hpLabel: HTMLDivElement };

export class AiEnemyView {
  private scene: Scene;
  private root: HTMLElement;
  private enemies = new Map<string, AiRenderState>();

  constructor(scene: Scene, root: HTMLElement) { this.scene = scene; this.root = root; }

  update(enemies: AiEnemySnapshot[]): void {
    const ids = new Set(enemies.map(e => e.id));
    for (const enemy of enemies) {
      let state = this.enemies.get(enemy.id);
      if (!state) { state = this.createEnemy(enemy); this.enemies.set(enemy.id, state); }
      if (enemy.alive) {
        state.mesh.rotation.z = 0;
        state.mesh.position.y = enemy.y - 0.85;
        state.mesh.scaling.set(1, 1, 1);
      } else {
        // Death: fall over
        state.mesh.rotation.z = Math.PI / 2;
        state.mesh.position.y = 0.45;
        state.mesh.scaling.set(1, 1, 1);
      }
      state.mesh.position.x = enemy.x;
      state.mesh.position.z = enemy.z;
      state.mesh.rotation.y = enemy.rotationY;

      state.material.diffuseColor = enemy.alive
        ? (enemy.state === "attack" ? new Color3(1, 0.22, 0.16) : new Color3(0.9, 0.65, 0.2))
        : new Color3(0.35, 0.35, 0.35);

      state.hpLabel.textContent = enemy.alive
        ? `${enemy.name}: ${enemy.hp}/${enemy.maxHp} ${enemy.state}`
        : `${enemy.name}: DEAD`;
      state.hpLabel.classList.toggle("target-dead", !enemy.alive);
    }
    for (const [id, state] of this.enemies.entries()) { if (!ids.has(id)) { state.mesh.dispose(); state.hpLabel.remove(); this.enemies.delete(id); } }
  }

  dispose(): void { for (const s of this.enemies.values()) { s.mesh.dispose(); s.hpLabel.remove(); } this.enemies.clear(); }

  private createEnemy(enemy: AiEnemySnapshot): AiRenderState {
    const mesh = MeshBuilder.CreateBox(`ai-enemy-${enemy.id}`, { width: 0.85, height: 1.7, depth: 0.85 }, this.scene);
    const material = new StandardMaterial(`ai-enemy-material-${enemy.id}`, this.scene);
    material.diffuseColor = new Color3(0.9, 0.65, 0.2); mesh.material = material;
    const hpLabel = document.createElement("div"); hpLabel.className = "ai-hp";
    hpLabel.textContent = `${enemy.name}: ${enemy.hp}/${enemy.maxHp}`;
    this.root.appendChild(hpLabel);
    return { mesh, material, hpLabel };
  }
}
