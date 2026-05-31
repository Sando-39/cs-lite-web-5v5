import { Color3, Mesh, MeshBuilder, Scene, StandardMaterial, Vector3 } from "@babylonjs/core";
import type { WeaponId } from "../../shared/weapons";

type Tracer = { mesh: Mesh; expiresAt: number };

export class TracerView {
  private scene: Scene; private tracers: Tracer[] = [];
  constructor(scene: Scene) { this.scene = scene; }

  spawn(start: { x: number; y: number; z: number }, end: { x: number; y: number; z: number }, weaponId: WeaponId): void {
    const sv = new Vector3(start.x, start.y, start.z), ev = new Vector3(end.x, end.y, end.z);
    const dir = ev.subtract(sv); const len = dir.length();
    if (len <= 0.01) return;
    const mesh = MeshBuilder.CreateCylinder(`tracer-${Date.now()}`, { height: len, diameter: weaponId === "r47" ? 0.045 : 0.028, tessellation: 6 }, this.scene);
    const mat = new StandardMaterial(`tracer-mat-${Date.now()}`, this.scene);
    mat.emissiveColor = weaponId === "r47" ? new Color3(1, 0.62, 0.18) : new Color3(0.55, 0.86, 1);
    mesh.material = mat;
    mesh.position = sv.add(ev).scale(0.5);
    // Align cylinder to direction
    const up = new Vector3(0, 1, 0);
    const quat = Vector3.RotationFromAxis(up, dir.normalize());
    mesh.rotationQuaternion = quat;
    this.tracers.push({ mesh, expiresAt: performance.now() + 90 });
  }

  update(now: number): void {
    this.tracers = this.tracers.filter(t => { if (now < t.expiresAt) return true; t.mesh.dispose(); return false; });
  }

  dispose(): void { for (const t of this.tracers) t.mesh.dispose(); this.tracers = []; }
}
