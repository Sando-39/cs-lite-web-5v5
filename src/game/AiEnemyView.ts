import { Color3, Mesh, MeshBuilder, Scene, StandardMaterial } from "@babylonjs/core";
import { MetricWindowCounter } from "./DebugMetrics";

export type AiEnemySnapshot = { id: string; name: string; x: number; y: number; z: number; rotationY: number; hp: number; maxHp: number; alive: boolean; state: string };

type AiRenderState = { mesh: Mesh; material: StandardMaterial; hpLabel: HTMLDivElement; lastLabelText: string; lastLabelUpdateAt: number };

export class AiEnemyView {
  private scene: Scene;
  private root: HTMLElement;
  private enemies = new Map<string, AiRenderState>();
  private labelUpdateCounter = new MetricWindowCounter(1000);

  constructor(scene: Scene, root: HTMLElement) { this.scene = scene; this.root = root; }

  update(enemies: AiEnemySnapshot[]): void {
    const now = performance.now();
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
        ? (enemy.state === "attack" ? new Color3(1, 0.12, 0.08) : new Color3(1, 0.35, 0.18))
        : new Color3(0.3, 0.3, 0.3);

      const newText = enemy.alive
        ? `ENEMY ${enemy.name}: ${enemy.hp}/${enemy.maxHp}`
        : `DEAD ${enemy.name}`;
      if (state.lastLabelText !== newText || now - state.lastLabelUpdateAt >= 200) {
        state.hpLabel.textContent = newText;
        state.lastLabelText = newText;
        state.lastLabelUpdateAt = now;
        this.labelUpdateCounter.increment(now);
      }
      state.hpLabel.classList.toggle("target-dead", !enemy.alive);
    }
    for (const [id, state] of this.enemies.entries()) { if (!ids.has(id)) { state.mesh.dispose(); state.hpLabel.remove(); this.enemies.delete(id); } }
  }

  dispose(): void { for (const s of this.enemies.values()) { s.mesh.dispose(); s.hpLabel.remove(); } this.enemies.clear(); }

  getDebugStats() { return { labelUpdatesPerSecond: this.labelUpdateCounter.getRate(performance.now()), enemyCount: this.enemies.size, aliveEnemyCount: Array.from(this.enemies.values()).filter(e => e.material.diffuseColor.r > 0.5).length }; }

  private createEnemy(enemy: AiEnemySnapshot): AiRenderState {
    const mesh = MeshBuilder.CreateBox(`ai-enemy-${enemy.id}`, { width: 0.85, height: 1.7, depth: 0.85 }, this.scene);
    const material = new StandardMaterial(`ai-enemy-material-${enemy.id}`, this.scene);
    material.diffuseColor = new Color3(0.9, 0.65, 0.2); mesh.material = material;
    const hpLabel = document.createElement("div"); hpLabel.className = "ai-hp";
    hpLabel.textContent = `${enemy.name}: ${enemy.hp}/${enemy.maxHp}`;
    this.root.appendChild(hpLabel);
    return { mesh, material, hpLabel, lastLabelText: hpLabel.textContent, lastLabelUpdateAt: 0 };
  }
}
