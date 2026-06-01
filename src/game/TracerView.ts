import { Color3, Mesh, MeshBuilder, Quaternion, Scene, StandardMaterial, Vector3 } from "@babylonjs/core";
import type { WeaponId } from "../../shared/weapons";

type PooledTracer = { mesh: Mesh; material: StandardMaterial; active: boolean; expiresAt: number };

export class TracerView {
  private scene: Scene;
  private tracers: PooledTracer[] = [];
  private spawnedThisSecond = 0;
  private lastSpawnResetAt = 0;

  constructor(scene: Scene) { this.scene = scene; }

  spawn(start: { x: number; y: number; z: number }, end: { x: number; y: number; z: number }, weaponId: WeaponId): void {
    const sv = new Vector3(start.x, start.y, start.z), ev = new Vector3(end.x, end.y, end.z);
    const dir = ev.subtract(sv); const len = dir.length();
    if (len <= 0.01) return;

    const diameter = weaponId === "r47" ? 0.045 : 0.028;
    const color = weaponId === "r47" ? new Color3(1, 0.62, 0.18) : new Color3(0.55, 0.86, 1);

    // Find existing inactive tracer
    let tracer = this.tracers.find(t => !t.active);
    if (!tracer) {
      // Create new
      const mesh = MeshBuilder.CreateCylinder(`tracer-pool-${this.tracers.length}`, { height: 1, diameter, tessellation: 6 }, this.scene);
      mesh.setEnabled(false);
      const mat = new StandardMaterial(`tracer-mat-pool-${this.tracers.length}`, this.scene);
      mesh.material = mat;
      tracer = { mesh, material: mat, active: false, expiresAt: 0 };
      this.tracers.push(tracer);
    }

    // Configure
    tracer.mesh.scaling.y = len;
    tracer.mesh.position = sv.add(ev).scale(0.5);
    const up = new Vector3(0, 1, 0);
    const quat = Quaternion.RotationQuaternionFromAxis(up, dir.normalize(), Vector3.Cross(up, dir.normalize()));
    tracer.mesh.rotationQuaternion = quat;
    tracer.material.emissiveColor = color;
    tracer.mesh.setEnabled(true);
    tracer.active = true;
    tracer.expiresAt = performance.now() + 90;

    // Per-second counter
    const now = performance.now();
    if (now - this.lastSpawnResetAt >= 1000) { this.spawnedThisSecond = 0; this.lastSpawnResetAt = now; }
    this.spawnedThisSecond++;
  }

  update(now: number): void {
    for (const t of this.tracers) {
      if (!t.active) continue;
      if (now >= t.expiresAt) { t.mesh.setEnabled(false); t.active = false; }
    }
  }

  dispose(): void { for (const t of this.tracers) { t.mesh.dispose(); } this.tracers = []; }

  getDebugStats() {
    const active = this.tracers.filter(t => t.active).length;
    return { activeCount: active, availableCount: this.tracers.length - active, totalCount: this.tracers.length, spawnedPerSecond: this.spawnedThisSecond };
  }
}
