import { Color3, Mesh, MeshBuilder, Scene, StandardMaterial, TransformNode } from "@babylonjs/core";
import { MUZZLE_FLASH_DURATION_MS } from "../../shared/constants";
import { getWeaponConfig, type WeaponId } from "../../shared/weapons";

export type RecoilOffset = { pitch: number; yaw: number };

export function applyRecoilImpulse(current: RecoilOffset, impulse: { vertical: number; horizontal: number }, direction: number): RecoilOffset {
  return { pitch: current.pitch + impulse.vertical, yaw: current.yaw + impulse.horizontal * direction };
}

export function recoverRecoil(current: RecoilOffset, amount: number): RecoilOffset {
  return { pitch: approachZero(current.pitch, amount), yaw: approachZero(current.yaw, amount) };
}

export class WeaponView {
  private scene: Scene;
  private root: TransformNode;
  private activeWeaponId: WeaponId = "ar4";
  private meshes = new Map<WeaponId, TransformNode>();
  private muzzleFlash: Mesh;
  private flashUntil = 0;
  private recoil: RecoilOffset = { pitch: 0, yaw: 0 };

  constructor(scene: Scene) {
    this.scene = scene;
    this.root = new TransformNode("weapon-view-root", scene);
    this.muzzleFlash = this.createMuzzleFlash();
    this.createWeapon("ar4", new Color3(0.2, 0.4, 0.85));
    this.createWeapon("r47", new Color3(0.75, 0.35, 0.16));
    this.setActiveWeapon("ar4");
  }

  setActiveWeapon(weaponId: WeaponId): void {
    this.activeWeaponId = weaponId;
    for (const [id, node] of this.meshes.entries()) node.setEnabled(id === weaponId);
  }

  playFire(weaponId: WeaponId): void {
    const config = getWeaponConfig(weaponId);
    this.recoil = applyRecoilImpulse(this.recoil, { vertical: config.verticalRecoil, horizontal: config.horizontalRecoil }, Math.random() > 0.5 ? 1 : -1);
    this.muzzleFlash.scaling.setAll(config.muzzleFlashScale);
    this.muzzleFlash.setEnabled(true);
    this.flashUntil = performance.now() + MUZZLE_FLASH_DURATION_MS;
  }

  playReload(): void {
    const weapon = this.meshes.get(this.activeWeaponId);
    if (weapon) weapon.position.y = -0.18;
  }

  update(cameraPosition: { x: number; y: number; z: number }, cameraRotationY: number): RecoilOffset {
    this.root.position.set(cameraPosition.x, cameraPosition.y - 0.25, cameraPosition.z);
    this.root.rotation.y = cameraRotationY;
    this.recoil = recoverRecoil(this.recoil, 0.006);
    if (performance.now() >= this.flashUntil) this.muzzleFlash.setEnabled(false);
    const weapon = this.meshes.get(this.activeWeaponId);
    if (weapon) weapon.position.y = approach(weapon.position.y, -0.35, 0.025);
    return this.recoil;
  }

  dispose(): void { this.root.dispose(); }

  private createWeapon(weaponId: WeaponId, color: Color3): void {
    const node = new TransformNode(`weapon-${weaponId}`, this.scene);
    node.parent = this.root; node.position.set(0.35, -0.35, 0.85); node.rotation.y = -0.08;
    const material = new StandardMaterial(`weapon-${weaponId}-mat`, this.scene);
    material.diffuseColor = color;
    const body = MeshBuilder.CreateBox(`${weaponId}-body`, { width: weaponId === "ar4" ? 0.55 : 0.62, height: 0.16, depth: 1.0 }, this.scene);
    body.parent = node; body.material = material;
    const barrel = MeshBuilder.CreateBox(`${weaponId}-barrel`, { width: 0.12, height: 0.1, depth: 0.55 }, this.scene);
    barrel.parent = node; barrel.position.z = 0.72; barrel.material = material;
    const mag = MeshBuilder.CreateBox(`${weaponId}-mag`, { width: 0.2, height: 0.38, depth: 0.16 }, this.scene);
    mag.parent = node; mag.position.y = -0.25; mag.position.z = -0.08; mag.material = material;
    this.meshes.set(weaponId, node);
  }

  private createMuzzleFlash(): Mesh {
    const mesh = MeshBuilder.CreateSphere("muzzle-flash", { diameter: 0.22, segments: 8 }, this.scene);
    const material = new StandardMaterial("muzzle-flash-mat", this.scene);
    material.emissiveColor = new Color3(1, 0.78, 0.22); material.diffuseColor = new Color3(1, 0.5, 0.1);
    mesh.material = material; mesh.parent = this.root; mesh.position.set(0.35, -0.32, 1.58); mesh.setEnabled(false);
    return mesh;
  }
}

function approachZero(value: number, amount: number): number { return Math.abs(value) <= amount ? 0 : value > 0 ? value - amount : value + amount; }
function approach(value: number, target: number, amount: number): number { return Math.abs(value - target) <= amount ? target : value < target ? value + amount : value - amount; }
