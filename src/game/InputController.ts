import { Vector3 } from "@babylonjs/core";
import {
  CAMERA_HEIGHT,
  MAP_HALF_SIZE,
  PLAYER_SPEED_UNITS_PER_SECOND
} from "../../shared/constants";
import type { MoveMessage } from "../../shared/types";

export type LocalTransform = MoveMessage;

export class InputController {
  private canvas: HTMLCanvasElement;
  private keys = new Set<string>();
  private yaw = 0;
  private pitch = 0;
  private position = new Vector3(0, CAMERA_HEIGHT, 0);
  private isPointerLocked = false;

  constructor(canvas: HTMLCanvasElement, initial: MoveMessage) {
    this.canvas = canvas;
    this.position.set(initial.x, CAMERA_HEIGHT, initial.z);
    this.yaw = initial.rotationY;
  }

  attach(): void {
    window.addEventListener("keydown", this.handleKeyDown);
    window.addEventListener("keyup", this.handleKeyUp);
    window.addEventListener("mousemove", this.handleMouseMove);
    document.addEventListener("pointerlockchange", this.handlePointerLockChange);

    this.canvas.addEventListener("click", () => {
      void this.canvas.requestPointerLock();
    });
  }

  detach(): void {
    window.removeEventListener("keydown", this.handleKeyDown);
    window.removeEventListener("keyup", this.handleKeyUp);
    window.removeEventListener("mousemove", this.handleMouseMove);
    document.removeEventListener("pointerlockchange", this.handlePointerLockChange);
  }

  update(deltaSeconds: number): LocalTransform {
    const forwardInput = Number(this.keys.has("KeyW")) - Number(this.keys.has("KeyS"));
    const rightInput = Number(this.keys.has("KeyD")) - Number(this.keys.has("KeyA"));

    const forward = new Vector3(Math.sin(this.yaw), 0, Math.cos(this.yaw));
    const right = new Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw));

    const movement = forward
      .scale(forwardInput)
      .add(right.scale(rightInput));

    if (movement.lengthSquared() > 0) {
      movement.normalize();
      movement.scaleInPlace(PLAYER_SPEED_UNITS_PER_SECOND * deltaSeconds);
      this.position.addInPlace(movement);
      this.position.x = this.clampToBounds(this.position.x);
      this.position.y = CAMERA_HEIGHT;
      this.position.z = this.clampToBounds(this.position.z);
    }

    return {
      x: this.position.x,
      y: CAMERA_HEIGHT,
      z: this.position.z,
      rotationY: this.yaw
    };
  }

  getPitch(): number {
    return this.pitch;
  }

  isMouseLocked(): boolean {
    return this.isPointerLocked;
  }

  private handleKeyDown = (event: KeyboardEvent): void => {
    this.keys.add(event.code);
  };

  private handleKeyUp = (event: KeyboardEvent): void => {
    this.keys.delete(event.code);
  };

  private handleMouseMove = (event: MouseEvent): void => {
    if (!this.isPointerLocked) {
      return;
    }

    const sensitivity = 0.0022;
    this.yaw += event.movementX * sensitivity;
    this.pitch += event.movementY * sensitivity;
    this.pitch = Math.max(-1.35, Math.min(1.35, this.pitch));
  };

  private handlePointerLockChange = (): void => {
    this.isPointerLocked = document.pointerLockElement === this.canvas;
  };

  private clampToBounds(value: number): number {
    const margin = 1;
    return Math.max(-MAP_HALF_SIZE + margin, Math.min(MAP_HALF_SIZE - margin, value));
  }
}
