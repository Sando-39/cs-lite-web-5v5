import {
  Engine,
  FreeCamera,
  Scene,
  Vector3
} from "@babylonjs/core";
import { CAMERA_HEIGHT, MOVE_SEND_HZ, PING_INTERVAL_MS } from "../../shared/constants";
import type { MoveMessage, ServerDebugStatsMessage } from "../../shared/types";
import { formatFireResultMessage, formatWeaponFireResultMessage } from "../network/NetworkClient";
import { NetworkClient } from "../network/NetworkClient";
import { HitFeedback } from "./HitFeedback";
import { InputController } from "./InputController";
import { MapBuilder } from "./MapBuilder";
import { RemotePlayerView } from "./RemotePlayerView";
import { TargetView } from "./TargetView";
import { DebugHud, type DebugSnapshot } from "./DebugHud";
import { MetricSeries } from "./DebugMetrics";
import type { WeaponId } from "../../shared/weapons";
import { WEAPONS } from "../../shared/weapons";
import { WeaponView } from "./WeaponView";
import { GameAudio } from "./GameAudio";
import { AiEnemyView } from "./AiEnemyView";
import { WeaponHud } from "./WeaponHud";
import { ReloadProgress } from "./ReloadProgress";
import { TracerView } from "./TracerView";

export class ClientGame {
  private root: HTMLDivElement;
  private network: NetworkClient;
  private engine: Engine | null = null;
  private scene: Scene | null = null;
  private camera: FreeCamera | null = null;
  private input: InputController | null = null;
  private remotePlayers: RemotePlayerView | null = null;
  private targetView: TargetView | null = null;
  private canvas: HTMLCanvasElement | null = null;
  private debugHud: DebugHud | null = null;
  private hitFeedback: HitFeedback | null = null;
  private activeWeaponId: WeaponId = "ar4";
  private weaponView: WeaponView | null = null;
  private weaponHud: WeaponHud | null = null;
  private aiEnemyView: AiEnemyView | null = null;
  private reloadProgress: ReloadProgress | null = null;
  private tracerview: TracerView | null = null;
  private gameAudio = new GameAudio();
  private damagePunch = 0;
  private lastMoveSentAt = 0;
  private lastPingSentAt = 0;
  private currentTransform: MoveMessage = {
    x: 0,
    y: CAMERA_HEIGHT,
    z: 0,
    rotationY: 0
  };

  // Metrics
  private fpsSeries = new MetricSeries(120);
  private frameTimeSeries = new MetricSeries(120);
  private fireSendSeries = new MetricSeries(120);
  private serverTickSeries = new MetricSeries(120);
  private lastFrameAt = 0;
  private lastDebugHudRenderAt = 0;
  private serverDebugStats: ServerDebugStatsMessage | null = null;

  // RPM throttle
  private nextLocalFireAt = 0;

  // Fire held state
  private isFireHeld = false;

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
          <div class="hud-card debug-card" id="debug-hud"><strong>Debug:</strong> F3 展开</div>
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

    this.weaponView = new WeaponView(this.scene);

    this.tracerView = new TracerView(this.scene);

    this.reloadProgress = new ReloadProgress(this.root);

    const initial = this.getInitialLocalTransform();
    this.input = new InputController(canvas, initial, {
      onFireHeld: () => { this.isFireHeld = true; },
      onReload: () => { this.network.sendReload(this.activeWeaponId, performance.now()); this.gameAudio.playReload(); },
      onSwitchWeapon: (weaponId) => { this.activeWeaponId = weaponId; this.network.sendSwitchWeapon(weaponId, performance.now()); this.weaponView?.setActiveWeapon(weaponId); }
    });
    this.input.attach();

    this.gameAudio.unlock();

    this.remotePlayers = new RemotePlayerView(this.scene);

    this.weaponHud = new WeaponHud(this.root);

    // TargetView removed in v0.4.1 — static targets replaced by AI enemies.
    // this.targetView = new TargetView(this.scene, this.root);

    this.aiEnemyView = new AiEnemyView(this.scene, this.root);

    this.hitFeedback = new HitFeedback(this.root);
    this.network.setFireResultHandler((result) => {
      const message = formatFireResultMessage(result, this.network.sessionId);
      if (message) this.hitFeedback?.show(message);
    });
    this.network.setWeaponFireResultHandler((result) => {
      if (result.accepted && result.reason === "fired") {
        this.weaponView?.playAcceptedFire(result.weaponId);
        this.gameAudio.playFire(result.weaponId);
        if (result.tracerStart && result.tracerEnd) {
          this.tracerView?.spawn(result.tracerStart, result.tracerEnd, result.weaponId);
        }
        if (result.hit) this.gameAudio.playHit();
        const msg = formatWeaponFireResultMessage(result, this.network.sessionId);
        if (msg) this.hitFeedback?.show(msg);
      } else if (result.reason === "empty_mag") {
        this.weaponView?.playEmptyClick();
        this.gameAudio.playEmpty();
        this.hitFeedback?.show("弹匣为空，按 R 换弹");
      } else if (result.reason === "reloading") {
        this.hitFeedback?.show("正在换弹");
      }
    });
    this.network.setTargetRespawnedHandler(() => {
      this.hitFeedback?.show("假人已复活");
    });

    this.network.setReloadResultHandler((result) => {
      if (result.started) {
        this.weaponView?.playReloadStart(result.reloadEndsAt - performance.now());
      }
    });

    this.network.setPlayerDamagedHandler((message) => {
      if (message.sessionId === this.network.sessionId) {
        this.damagePunch = 0.08;
        this.gameAudio.playDamage();
        this.hitFeedback?.show(`受到 ${message.damage} 点伤害，HP: ${message.hp}`);
      }
    });

    this.network.setServerDebugStatsHandler((stats) => {
      this.serverDebugStats = stats;
      this.serverTickSeries.push(stats.tickMs);
    });

    this.debugHud = new DebugHud(this.root);
    this.debugHud.attach();

    window.addEventListener("resize", this.handleResize);

    this.engine.runRenderLoop(() => {
      this.tick();
    });
  }

  dispose(): void {
    window.removeEventListener("resize", this.handleResize);
    this.input?.detach();
    this.remotePlayers?.dispose();
    // this.targetView?.dispose();
    this.aiEnemyView?.dispose();
    this.aiEnemyView = null;
    this.hitFeedback?.dispose();
    this.hitFeedback = null;
    this.weaponView?.dispose();
    this.weaponView = null;
    this.tracerView?.dispose();
    this.tracerView = null;
    this.weaponHud?.dispose();
    this.weaponHud = null;
    this.reloadProgress?.dispose();
    this.reloadProgress = null;
    this.debugHud?.detach();
    this.scene?.dispose();
    this.engine?.dispose();
    this.engine = null;
    this.scene = null;
    this.camera = null;
    this.input = null;
    this.remotePlayers = null;
    // this.targetView = null;
    this.debugHud = null;
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
    this.camera.rotation.y = this.currentTransform.rotationY;

    const now = performance.now();

    // Sync fire held state from input and try RPM-throttled fire
    if (this.input) this.isFireHeld = this.input.isFireHeld();
    this.trySendHeldFire(now);

    // FPS / frame time tracking
    if (this.lastFrameAt > 0) {
      const deltaMs = now - this.lastFrameAt;
      const fps = 1000 / deltaMs;
      this.fpsSeries.push(fps);
      this.frameTimeSeries.push(deltaMs);
    }
    this.lastFrameAt = now;

    const weaponPunch = this.weaponView?.update(this.camera.position, this.currentTransform.rotationY, deltaSeconds);
    // Apply visual recoil punch on top of real aim, but DON'T modify real pitch
    this.camera.rotation.x = this.input.getPitch() + (weaponPunch?.pitchPunch ?? 0) + this.damagePunch;
    this.camera.rotation.y += weaponPunch?.yawPunch ?? 0;

    // Recover damage punch
    this.damagePunch = this.damagePunch > 0.001 ? this.damagePunch * 0.88 : 0;

    this.tracerView?.update(now);

    this.updateConnectionStatus();
    this.updatePointerHelp();
    this.updatePeerStatus();
    const sendIntervalMs = 1000 / MOVE_SEND_HZ;

    if (now - this.lastMoveSentAt >= sendIntervalMs) {
      this.network.sendMove(this.currentTransform);
      this.lastMoveSentAt = now;
    }

    this.sendPingIfNeeded(now);

    this.remotePlayers?.updateTargets(
      this.network.getPlayersSnapshot(),
      this.network.sessionId
    );
    this.remotePlayers?.render();

    // this.targetView?.update(this.network.getTargetsSnapshot());

    this.aiEnemyView?.update(this.network.getAiEnemiesSnapshot());

    this.hitFeedback?.update(now);

    const ownPlayer = this.network.getPlayersSnapshot().find(p => p.sessionId === this.network.sessionId);
    this.weaponHud?.render(this.activeWeaponId, this.network.getLocalWeaponSnapshots(), ownPlayer?.hp ?? null);

    this.reloadProgress?.render(this.activeWeaponId, this.network.getLocalWeaponSnapshots(), performance.now());

    if (now - this.lastDebugHudRenderAt >= 200) {
      this.lastDebugHudRenderAt = now;
      this.fireSendSeries.push(this.network.getNetworkDebugStats(now).fireSendsPerSecond);
      this.debugHud?.render(this.createDebugSnapshot(now));
    }

    this.scene.render();
  }

  private updateConnectionStatus(): void {
    const status = this.root.querySelector<HTMLDivElement>("#connection-status");

    if (!status) {
      return;
    }

    if (this.network.status === "connected") {
      status.innerHTML = "<strong>连接状态：</strong>已连接";
      return;
    }

    if (this.network.status === "disconnected") {
      status.innerHTML =
        "<strong>连接状态：</strong>连接已断开，请返回首页重新加入";
      return;
    }

    status.innerHTML = "<strong>连接状态：</strong>连接中";
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

    if (this.network.playerLeftSessionId) {
      status.textContent = "对方已离开房间。";
      return;
    }

    const remoteCount = this.remotePlayers?.getRemotePlayerCount() ?? 0;

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

  private sendPingIfNeeded(now: number): void {
    if (now - this.lastPingSentAt < PING_INTERVAL_MS) {
      return;
    }

    this.network.sendPing(now);
    this.lastPingSentAt = now;
  }

  private trySendHeldFire(now: number): void {
    if (!this.isFireHeld) return;
    const weapon = WEAPONS[this.activeWeaponId];
    const fireIntervalMs = 60000 / weapon.rpm;
    if (now < this.nextLocalFireAt) return;
    this.network.sendWeaponFire(this.activeWeaponId, now);
    this.nextLocalFireAt = now + fireIntervalMs;
  }

  private createDebugSnapshot(now: number): DebugSnapshot {
    const players = this.network.getPlayersSnapshot();
    const targets = this.network.getTargetsSnapshot();
    const primaryTarget = targets[0] ?? null;
    const netStats = this.network.getNetworkDebugStats(now);
    const pingSeries = this.network.getPingSeries();

    return {
      roomId: this.network.roomId,
      sessionId: this.network.sessionId,
      connectionStatus: this.network.status,
      playerCount: players.length,
      remotePlayerCount: this.remotePlayers?.getRemotePlayerCount() ?? 0,
      localX: this.currentTransform.x,
      localY: this.currentTransform.y,
      localZ: this.currentTransform.z,
      localRotationY: this.currentTransform.rotationY,
      pitch: this.currentTransform.pitch,
      moveSendHzTarget: MOVE_SEND_HZ,
      lastMoveSentMsAgo: this.lastMoveSentAt > 0 ? now - this.lastMoveSentAt : null,
      remoteUpdateAgeMs: this.remotePlayers?.getNewestSnapshotAgeMs() ?? null,
      // ping
      pingEstimateMs: this.network.getPingEstimateMs(),
      pingAvg: pingSeries.getAverage(),
      pingMin: pingSeries.getMin(),
      pingMax: pingSeries.getMax(),
      pingJitter: pingSeries.getJitter(),
      // fps
      fps: this.fpsSeries.getLatest(),
      fpsAvg: this.fpsSeries.getAverage(),
      frameMs: this.frameTimeSeries.getLatest(),
      frameMsAvg: this.frameTimeSeries.getAverage(),
      // network rates
      moveSendsPerSecond: netStats.moveSendsPerSecond,
      fireSendsPerSecond: netStats.fireSendsPerSecond,
      reloadSendsPerSecond: netStats.reloadSendsPerSecond,
      messagesReceivedPerSecond: netStats.messagesReceivedPerSecond,
      webSocketBufferedAmount: netStats.webSocketBufferedAmount,
      // server
      serverTickMs: this.serverDebugStats?.tickMs ?? null,
      serverAiUpdateMs: this.serverDebugStats?.aiUpdateMs ?? null,
      serverFireProcessingMs: this.serverDebugStats?.fireProcessingMs ?? null,
      serverFireAcceptedPerSec: this.serverDebugStats?.fireAcceptedPerSecond ?? null,
      serverFireRejectedPerSec: this.serverDebugStats?.fireRejectedPerSecond ?? null,
      serverAliveAiCount: this.serverDebugStats?.aliveAiCount ?? null,
      // target
      targetHp: primaryTarget?.hp ?? null,
      targetAlive: primaryTarget?.alive ?? null,
      // series refs
      pingSeries,
      fpsSeries: this.fpsSeries,
      fireSendSeries: this.fireSendSeries,
      serverTickSeries: this.serverTickSeries,
    };
  }
}
