import { Color3, Mesh, MeshBuilder, Scene, StandardMaterial, TransformNode, Vector3 } from "@babylonjs/core";
import { MUZZLE_FLASH_DURATION_MS } from "../../shared/constants";
import { getWeaponConfig, type WeaponId } from "../../shared/weapons";

export type VisualRecoilState = { pitchPunch: number; yawPunch: number };

export function applyRecoilImpulse(current: VisualRecoilState, impulse: { pitch: number; yaw: number }): VisualRecoilState {
  return { pitchPunch: current.pitchPunch + impulse.pitch, yawPunch: current.yawPunch + impulse.yaw };
}

export function recoverVisualRecoil(current: VisualRecoilState, amount: number): VisualRecoilState {
  return { pitchPunch: approachZero(current.pitchPunch, amount), yawPunch: approachZero(current.yawPunch, amount) };
}

type WeaponAnimState = { idleTime: number; fireKick: number; reloadT: number; switchT: number; emptyClickT: number; isReloading: boolean; isSwitching: boolean };

export class WeaponView {
  private scene: Scene;
  private root: TransformNode;
  private activeWeaponId: WeaponId = "ar4";
  private weaponNodes = new Map<WeaponId, { node: TransformNode; mag: Mesh; parts: TransformNode[] }>();
  private muzzleFlashGroup: TransformNode;
  private flashCore: Mesh;
  private flashBurst: Mesh;
  private flashCone: Mesh;
  private flashUntil = 0;
  private recoil: VisualRecoilState = { pitchPunch: 0, yawPunch: 0 };
  private anim: WeaponAnimState = { idleTime: 0, fireKick: 0, reloadT: 0, switchT: 0, emptyClickT: 0, isReloading: false, isSwitching: false };
  private animReloadMs = 1900;

  constructor(scene: Scene) {
    this.scene = scene;
    this.root = new TransformNode("weapon-root", scene);
    this.muzzleFlashGroup = new TransformNode("muzzle-flash-group", scene);
    this.muzzleFlashGroup.parent = this.root;
    this.muzzleFlashGroup.position.set(0.35, -0.32, 1.58);
    this.flashCore = this.createFlashPart("flash-core", new Color3(1, 0.95, 0.7), 0.08);
    this.flashBurst = this.createFlashPart("flash-burst", new Color3(1, 0.55, 0.12), 0.14);
    this.flashCone = this.createFlashPart("flash-cone", new Color3(1, 0.7, 0.25), 0.06);
    this.flashCone.scaling.set(1.2, 0.3, 1.2);
    this.hideFlash();
    this.buildAr4();
    this.buildR47();
    this.setActiveWeapon("ar4");
  }

  setActiveWeapon(weaponId: WeaponId): void {
    this.activeWeaponId = weaponId;
    for (const [id, w] of this.weaponNodes.entries()) w.node.setEnabled(id === weaponId);
    if (this.anim.isReloading) { this.anim.isReloading = false; this.anim.reloadT = 0; }
    this.anim.isSwitching = true; this.anim.switchT = 0;
  }

  playAcceptedFire(weaponId: WeaponId): void {
    const config = getWeaponConfig(weaponId);
    this.recoil = applyRecoilImpulse(this.recoil, { pitch: config.verticalRecoil * 0.5, yaw: config.horizontalRecoil * (Math.random() > 0.5 ? 1 : -1) * 0.3 });
    this.anim.fireKick = 1;
    this.showFlash(weaponId);
  }

  playEmptyClick(): void { this.anim.emptyClickT = 1; }
  playReloadStart(totalMs: number): void { this.anim.isReloading = true; this.anim.reloadT = 0; this.animReloadMs = totalMs; }

  update(cameraPos: { x: number; y: number; z: number }, cameraYaw: number, deltaSec: number): VisualRecoilState {
    this.root.position.set(cameraPos.x, cameraPos.y - 0.25, cameraPos.z);
    this.root.rotation.y = cameraYaw;
    this.anim.idleTime += deltaSec;
    this.recoil = recoverVisualRecoil(this.recoil, 0.004);
    if (performance.now() >= this.flashUntil) this.hideFlash();
    // Animations
    this.anim.fireKick = approachZero(this.anim.fireKick, deltaSec * 8);
    this.anim.emptyClickT = approachZero(this.anim.emptyClickT, deltaSec * 12);
    if (this.anim.isSwitching) { this.anim.switchT += deltaSec * 5; if (this.anim.switchT >= 1) { this.anim.switchT = 1; this.anim.isSwitching = false; } }
    // Apply to weapon nodes
    for (const [id, w] of this.weaponNodes.entries()) {
      const isActive = id === this.activeWeaponId;
      if (!isActive && !this.anim.isSwitching) continue;
      const baseY = -0.35;
      let y = baseY;
      // Idle sway
      const sway = Math.sin(this.anim.idleTime * 2.5) * 0.004;
      // Fire kick
      const kickZ = this.anim.fireKick * 0.06;
      // Reload
      if (this.anim.isReloading && isActive) { this.anim.reloadT += deltaSec; const t = Math.min(1, this.anim.reloadT / (this.animReloadMs / 1000)); y = baseY - 0.2 * (t < 0.5 ? t * 2 : 2 - t * 2); if (w.mag) w.mag.position.y = -0.25 - (t > 0.3 && t < 0.7 ? 0.4 : 0); }
      // Switch
      let switchY = 0;
      if (this.anim.isSwitching) { const t = this.anim.switchT; switchY = isActive ? (1 - t) * 0.3 : -t * 0.3; y += switchY; }
      // Empty click
      const clickShake = this.anim.emptyClickT * 0.02 * Math.sin(this.anim.emptyClickT * 30);
      w.node.position.set(0.35 + sway, y, 0.85 - kickZ);
      w.node.rotation.set(clickShake, -0.08 + sway, clickShake * 0.5);
    }
    return this.recoil;
  }

  dispose(): void { this.root.dispose(); }

  private showFlash(weaponId: WeaponId): void {
    const s = getWeaponConfig(weaponId).muzzleFlashScale;
    this.flashCore.scaling.setAll(s * 0.6 + Math.random() * 0.2);
    this.flashBurst.scaling.setAll(s * 1.1 + Math.random() * 0.3);
    this.flashBurst.rotation.z = Math.random() * Math.PI * 2;
    this.flashCore.setEnabled(true); this.flashBurst.setEnabled(true); this.flashCone.setEnabled(true);
    this.flashUntil = performance.now() + MUZZLE_FLASH_DURATION_MS;
  }

  private hideFlash(): void { this.flashCore.setEnabled(false); this.flashBurst.setEnabled(false); this.flashCone.setEnabled(false); }

  private createFlashPart(name: string, emissive: Color3, size: number): Mesh {
    const m = MeshBuilder.CreateSphere(name, { diameter: size, segments: 6 }, this.scene);
    const mat = new StandardMaterial(`${name}-mat`, this.scene);
    mat.emissiveColor = emissive; mat.diffuseColor = emissive.scale(0.5); m.material = mat;
    m.parent = this.muzzleFlashGroup; m.setEnabled(false); return m;
  }

  private buildAr4(): void { this.weaponNodes.set("ar4", this.buildWeapon("ar4", new Color3(0.15, 0.2, 0.35), new Color3(0.12, 0.12, 0.18), 0.55, 1.0)); }
  private buildR47(): void { this.weaponNodes.set("r47", this.buildWeapon("r47", new Color3(0.45, 0.25, 0.15), new Color3(0.15, 0.1, 0.06), 0.62, 1.05)); }

  private buildWeapon(id: WeaponId, bodyColor: Color3, darkColor: Color3, width: number, depth: number): { node: TransformNode; mag: Mesh; parts: TransformNode[] } {
    const node = new TransformNode(`wp-${id}`, this.scene); node.parent = this.root; node.position.set(0.35, -0.35, 0.85); node.rotation.y = -0.08;
    const parts: TransformNode[] = [];
    // Receiver
    const receiver = MeshBuilder.CreateBox(`${id}-receiver`, { width, height: 0.14, depth }, this.scene);
    receiver.parent = node; receiver.material = makeMat(this.scene, `${id}-recv`, bodyColor); parts.push(receiver);
    // Barrel
    const barrel = MeshBuilder.CreateBox(`${id}-barrel`, { width: 0.08, height: 0.07, depth: 0.55 }, this.scene);
    barrel.parent = node; barrel.position.z = 0.72; barrel.material = makeMat(this.scene, `${id}-barr`, darkColor); parts.push(barrel);
    // Stock
    const stock = MeshBuilder.CreateBox(`${id}-stock`, { width: width * 0.6, height: 0.12, depth: 0.35 }, this.scene);
    stock.parent = node; stock.position.z = -0.55; stock.material = makeMat(this.scene, `${id}-stk`, darkColor); parts.push(stock);
    // Grip
    const grip = MeshBuilder.CreateBox(`${id}-grip`, { width: 0.16, height: 0.35, depth: 0.14 }, this.scene);
    grip.parent = node; grip.position.y = -0.22; grip.position.z = -0.05; grip.material = makeMat(this.scene, `${id}-grp`, darkColor); parts.push(grip);
    // Magazine
    const mag = MeshBuilder.CreateBox(`${id}-mag`, { width: 0.18, height: 0.38, depth: 0.13 }, this.scene);
    mag.parent = node; mag.position.y = -0.25; mag.position.z = -0.06; mag.material = makeMat(this.scene, `${id}-mag`, darkColor.scale(0.7));
    // Front sight
    const fs = MeshBuilder.CreateBox(`${id}-fs`, { width: 0.04, height: 0.06, depth: 0.04 }, this.scene);
    fs.parent = node; fs.position.y = 0.1; fs.position.z = 0.65; fs.material = makeMat(this.scene, `${id}-fs`, darkColor); parts.push(fs);
    // Rear sight
    const rs = MeshBuilder.CreateBox(`${id}-rs`, { width: 0.05, height: 0.07, depth: 0.05 }, this.scene);
    rs.parent = node; rs.position.y = 0.12; rs.position.z = 0.2; rs.material = makeMat(this.scene, `${id}-rs`, darkColor); parts.push(rs);
    return { node, mag, parts };
  }
}

function makeMat(scene: Scene, name: string, color: Color3): StandardMaterial {
  const m = new StandardMaterial(name, scene); m.diffuseColor = color; return m;
}

function approachZero(v: number, amount: number): number { return Math.abs(v) <= amount ? 0 : v > 0 ? v - amount : v + amount; }
