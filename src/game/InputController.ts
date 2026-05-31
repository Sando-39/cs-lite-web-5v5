import { Vector3 } from "@babylonjs/core";
import { CAMERA_HEIGHT, PLAYER_SPEED_UNITS_PER_SECOND } from "../../shared/constants";
import { resolveMapMovement } from "../../shared/collision";
import type { MoveMessage } from "../../shared/types";
import type { WeaponId } from "../../shared/weapons";

export type LocalTransform = MoveMessage;
export type WeaponInputCallbacks = { onFireHeld(): void; onReload(): void; onSwitchWeapon(weaponId: WeaponId): void };

export class InputController {
  private canvas: HTMLCanvasElement;
  private keys = new Set<string>();
  private yaw = 0;
  private pitch = 0;
  private position = new Vector3(0, CAMERA_HEIGHT, 0);
  private isPointerLocked = false;
  private callbacks: WeaponInputCallbacks;
  private isFireHeld = false;

  constructor(canvas: HTMLCanvasElement, initial: MoveMessage, callbacks: Partial<WeaponInputCallbacks> = {}) {
    this.canvas = canvas;
    this.position.set(initial.x, CAMERA_HEIGHT, initial.z);
    this.yaw = initial.rotationY;
    this.pitch = initial.pitch ?? 0;
    this.callbacks = { onFireHeld: callbacks.onFireHeld ?? (() => undefined), onReload: callbacks.onReload ?? (() => undefined), onSwitchWeapon: callbacks.onSwitchWeapon ?? (() => undefined) };
  }

  attach(): void {
    window.addEventListener("keydown", this.handleKeyDown);
    window.addEventListener("keyup", this.handleKeyUp);
    window.addEventListener("mousemove", this.handleMouseMove);
    window.addEventListener("mousedown", this.handleMouseDown);
    window.addEventListener("mouseup", this.handleMouseUp);
    document.addEventListener("pointerlockchange", this.handlePointerLockChange);
    this.canvas.addEventListener("click", this.requestPointerLock);
  }

  detach(): void {
    window.removeEventListener("keydown", this.handleKeyDown);
    window.removeEventListener("keyup", this.handleKeyUp);
    window.removeEventListener("mousemove", this.handleMouseMove);
    window.removeEventListener("mousedown", this.handleMouseDown);
    window.removeEventListener("mouseup", this.handleMouseUp);
    document.removeEventListener("pointerlockchange", this.handlePointerLockChange);
    this.canvas.removeEventListener("click", this.requestPointerLock);
  }

  update(deltaSeconds: number): LocalTransform {
    const forwardInput = Number(this.keys.has("KeyW")) - Number(this.keys.has("KeyS"));
    const rightInput = Number(this.keys.has("KeyD")) - Number(this.keys.has("KeyA"));
    const forward = new Vector3(Math.sin(this.yaw), 0, Math.cos(this.yaw));
    const right = new Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
    const movement = forward.scale(forwardInput).add(right.scale(rightInput));
    if (movement.lengthSquared() > 0) {
      movement.normalize();
      movement.scaleInPlace(PLAYER_SPEED_UNITS_PER_SECOND * deltaSeconds);
      const resolved = resolveMapMovement({ x: this.position.x, z: this.position.z }, { x: this.position.x + movement.x, z: this.position.z + movement.z });
      this.position.x = resolved.x; this.position.y = CAMERA_HEIGHT; this.position.z = resolved.z;
    }
    if (this.isFireHeld && this.isPointerLocked) this.callbacks.onFireHeld();
    return { x: this.position.x, y: CAMERA_HEIGHT, z: this.position.z, rotationY: this.yaw, pitch: this.pitch };
  }

  getPitch(): number { return this.pitch; }
  isMouseLocked(): boolean { return this.isPointerLocked; }

  private requestPointerLock = (): void => { void this.canvas.requestPointerLock(); };
  private handleKeyDown = (event: KeyboardEvent): void => {
    this.keys.add(event.code);
    if (event.code === "KeyR") this.callbacks.onReload();
    if (event.code === "Digit1") this.callbacks.onSwitchWeapon("ar4");
    if (event.code === "Digit2") this.callbacks.onSwitchWeapon("r47");
  };
  private handleKeyUp = (event: KeyboardEvent): void => { this.keys.delete(event.code); };
  private handleMouseMove = (event: MouseEvent): void => {
    if (!this.isPointerLocked) return;
    const sensitivity = 0.0022;
    this.yaw += event.movementX * sensitivity;
    this.pitch += event.movementY * sensitivity;
    this.pitch = Math.max(-1.35, Math.min(1.35, this.pitch));
  };
  private handleMouseDown = (event: MouseEvent): void => { if (event.button === 0 && this.isPointerLocked) this.isFireHeld = true; };
  private handleMouseUp = (event: MouseEvent): void => { if (event.button === 0) this.isFireHeld = false; };
  private handlePointerLockChange = (): void => { this.isPointerLocked = document.pointerLockElement === this.canvas; };
}
