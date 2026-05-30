import {
  Engine,
  FreeCamera,
  Scene,
  Vector3
} from "@babylonjs/core";
import { CAMERA_HEIGHT, MOVE_SEND_HZ } from "../../shared/constants";
import type { MoveMessage } from "../../shared/types";
import { NetworkClient } from "../network/NetworkClient";
import { InputController } from "./InputController";
import { MapBuilder } from "./MapBuilder";
import { RemotePlayerView } from "./RemotePlayerView";

export class ClientGame {
  private root: HTMLDivElement;
  private network: NetworkClient;
  private engine: Engine | null = null;
  private scene: Scene | null = null;
  private camera: FreeCamera | null = null;
  private input: InputController | null = null;
  private remotePlayers: RemotePlayerView | null = null;
  private canvas: HTMLCanvasElement | null = null;
  private lastMoveSentAt = 0;
  private currentTransform: MoveMessage = {
    x: 0,
    y: CAMERA_HEIGHT,
    z: 0,
    rotationY: 0
  };

  constructor(root: HTMLDivElement, network: NetworkClient) {
    this.root = root;
    this.network = network;
  }

  start(): void {
    this.root.innerHTML = `
      <div class="game-shell">
        <canvas class="game-canvas" tabindex="0"></canvas>
        <div class="crosshair"></div>
        <div class="game-hud">
          <div class="hud-card"><strong>房间码：</strong>${this.network.roomId ?? "未知"}</div>
          <div class="hud-card" id="connection-status"><strong>连接状态：</strong>已连接</div>
          <div class="hud-card" id="peer-status">等待另一名玩家加入。</div>
          <div class="hud-card" id="pointer-help">点击画面锁定鼠标。WASD 移动，ESC 退出鼠标锁定。</div>
        </div>
      </div>
    `;

    const canvas = this.root.querySelector<HTMLCanvasElement>(".game-canvas");

    if (!canvas) {
      throw new Error("Missing game canvas.");
    }

    this.canvas = canvas;
    this.engine = new Engine(canvas, true);
    this.scene = new Scene(this.engine);

    MapBuilder.build(this.scene);

    this.camera = new FreeCamera(
      "player-camera",
      new Vector3(0, CAMERA_HEIGHT, 0),
      this.scene
    );
    this.camera.minZ = 0.1;
    this.camera.maxZ = 200;
    this.camera.fov = 1.1;

    const initial = this.getInitialLocalTransform();
    this.input = new InputController(canvas, initial);
    this.input.attach();

    this.remotePlayers = new RemotePlayerView(this.scene);

    window.addEventListener("resize", this.handleResize);

    this.engine.runRenderLoop(() => {
      this.tick();
    });
  }

  dispose(): void {
    window.removeEventListener("resize", this.handleResize);
    this.input?.detach();
    this.remotePlayers?.dispose();
    this.scene?.dispose();
    this.engine?.dispose();
    this.engine = null;
    this.scene = null;
    this.camera = null;
    this.input = null;
    this.remotePlayers = null;
    this.canvas = null;
  }

  private tick(): void {
    if (!this.engine || !this.scene || !this.camera || !this.input) {
      return;
    }

    const deltaSeconds = this.engine.getDeltaTime() / 1000;
    this.currentTransform = this.input.update(deltaSeconds);

    this.camera.position.set(
      this.currentTransform.x,
      CAMERA_HEIGHT,
      this.currentTransform.z
    );
    this.camera.rotation.x = this.input.getPitch();
    this.camera.rotation.y = this.currentTransform.rotationY;

    this.updatePointerHelp();
    this.updatePeerStatus();

    const now = performance.now();
    const sendIntervalMs = 1000 / MOVE_SEND_HZ;

    if (now - this.lastMoveSentAt >= sendIntervalMs) {
      this.network.sendMove(this.currentTransform);
      this.lastMoveSentAt = now;
    }

    this.remotePlayers?.update(
      this.network.getPlayersSnapshot(),
      this.network.sessionId
    );

    this.scene.render();
  }

  private updatePointerHelp(): void {
    const help = this.root.querySelector<HTMLDivElement>("#pointer-help");

    if (!help || !this.input) {
      return;
    }

    help.textContent = this.input.isMouseLocked()
      ? "鼠标已锁定。WASD 移动，ESC 退出。"
      : "点击画面锁定鼠标。WASD 移动，ESC 退出鼠标锁定。";
  }

  private updatePeerStatus(): void {
    const status = this.root.querySelector<HTMLDivElement>("#peer-status");

    if (!status) {
      return;
    }

    const players = this.network.getPlayersSnapshot();
    const remoteCount = players.filter(
      (player) => player.sessionId !== this.network.sessionId
    ).length;

    status.textContent =
      remoteCount > 0 ? "另一名玩家已加入。" : "等待另一名玩家加入。";
  }

  private getInitialLocalTransform(): MoveMessage {
    const ownSessionId = this.network.sessionId;
    const players = this.network.getPlayersSnapshot();
    const ownPlayer = players.find((player) => player.sessionId === ownSessionId);

    if (!ownPlayer) {
      return {
        x: 0,
        y: CAMERA_HEIGHT,
        z: 0,
        rotationY: 0
      };
    }

    return {
      x: ownPlayer.x,
      y: ownPlayer.y,
      z: ownPlayer.z,
      rotationY: ownPlayer.rotationY
    };
  }

  private handleResize = (): void => {
    this.engine?.resize();
  };
}
