import type { ConnectionStatus } from "../network/NetworkClient";
import type { ServerDebugStatsMessage } from "../../shared/types";
import { MetricSeries } from "./DebugMetrics";
import { DebugLineChart } from "./DebugLineChart";

export type DebugSnapshot = {
  roomId: string | null; sessionId: string | null; connectionStatus: ConnectionStatus;
  playerCount: number; remotePlayerCount: number;
  localX: number; localY: number; localZ: number; localRotationY: number;
  pitch: number; moveSendHzTarget: number; lastMoveSentMsAgo: number | null;
  remoteUpdateAgeMs: number | null;
  // ping
  pingEstimateMs: number | null; pingAvg: number | null; pingMin: number | null; pingMax: number | null; pingJitter: number | null;
  // fps
  fps: number | null; fpsAvg: number | null; frameMs: number | null; frameMsAvg: number | null;
  // network rates
  moveSendsPerSecond: number; fireSendsPerSecond: number; reloadSendsPerSecond: number;
  messagesReceivedPerSecond: number; webSocketBufferedAmount: number | null;
  // server
  serverTickMs: number | null; serverAiUpdateMs: number | null; serverFireProcessingMs: number | null;
  serverFireAcceptedPerSec: number | null; serverFireRejectedPerSec: number | null;
  serverAliveAiCount: number | null;
  // server msg stats
  targetedMsgPerSec: number | null; broadcastMsgPerSec: number | null;
  aiUpdateHz: number | null; simulationHz: number | null;
  // client object stats
  tracerActiveCount: number | null; tracerTotalCount: number | null;
  aiLabelUpdatesPerSec: number | null; weaponHudRendersPerSec: number | null;
  hitFeedbackShowsPerSec: number | null;
  // target
  targetHp: number | null; targetAlive: boolean | null;
  // series refs
  pingSeries: MetricSeries; fpsSeries: MetricSeries; fireSendSeries: MetricSeries; serverTickSeries: MetricSeries;
};

export class DebugHud {
  private root: HTMLElement;
  private expanded = false;
  private charts: { ping: DebugLineChart; fps: DebugLineChart; fire: DebugLineChart; tick: DebugLineChart } | null = null;
  private chartContainer: HTMLDivElement | null = null;

  constructor(root: HTMLElement) { this.root = root; }

  attach(): void { window.addEventListener("keydown", this.handleKeyDown); }
  detach(): void { window.removeEventListener("keydown", this.handleKeyDown); }

  private ensureCharts(force = false): void {
    if (force) {
      if (this.charts) {
        for (const chart of Object.values(this.charts)) chart.dispose();
        this.charts = null;
        this.chartContainer = null;
      }
    }
    if (this.charts) return;
    const container = this.root.querySelector<HTMLDivElement>("#debug-charts");
    if (!container) return;
    this.chartContainer = container;
    this.charts = {
      ping: new DebugLineChart(container, 220, 55),
      fps: new DebugLineChart(container, 220, 55),
      fire: new DebugLineChart(container, 220, 55),
      tick: new DebugLineChart(container, 220, 55)
    };
  }

  render(snapshot: DebugSnapshot): void {
    const container = this.root.querySelector<HTMLDivElement>("#debug-hud");
    if (!container) return;
    if (!this.expanded) { container.innerHTML = `<strong>Debug:</strong> F3 展开`; return; }

    container.innerHTML = `
      <strong>Debug</strong>
      <dl class="debug-grid">
        <dt>roomId</dt><dd>${f(snapshot.roomId)}</dd>
        <dt>sessionId</dt><dd>${f(snapshot.sessionId)}</dd>
        <dt>status</dt><dd>${snapshot.connectionStatus}</dd>
        <dt>players</dt><dd>${snapshot.playerCount} / remote ${snapshot.remotePlayerCount}</dd>
        <dt>local</dt><dd>${snapshot.localX.toFixed(2)}, ${snapshot.localY.toFixed(2)}, ${snapshot.localZ.toFixed(2)}</dd>
        <dt>rotY/pitch</dt><dd>${snapshot.localRotationY.toFixed(3)} / ${snapshot.pitch.toFixed(3)}</dd>
        <dt>FPS</dt><dd>${snapshot.fps?.toFixed(0) ?? "-"} (avg ${snapshot.fpsAvg?.toFixed(0) ?? "-"})</dd>
        <dt>frame</dt><dd>${ms(snapshot.frameMs)} (avg ${ms(snapshot.frameMsAvg)})</dd>
        <dt>ping</dt><dd>${ms(snapshot.pingEstimateMs)} avg ${ms(snapshot.pingAvg)} min ${ms(snapshot.pingMin)} max ${ms(snapshot.pingMax)} jit ${ms(snapshot.pingJitter)}</dd>
        <dt>send Hz</dt><dd>move ${snapshot.moveSendsPerSecond.toFixed(1)} fire ${snapshot.fireSendsPerSecond.toFixed(1)} reload ${snapshot.reloadSendsPerSecond.toFixed(1)}</dd>
        <dt>recv Hz</dt><dd>${snapshot.messagesReceivedPerSecond.toFixed(1)}</dd>
        <dt>WS buf</dt><dd>${snapshot.webSocketBufferedAmount !== null ? snapshot.webSocketBufferedAmount : "-"}</dd>
        <dt>sv tick</dt><dd>${ms(snapshot.serverTickMs)}</dd>
        <dt>sv ai</dt><dd>${ms(snapshot.serverAiUpdateMs)}</dd>
        <dt>sv fire</dt><dd>${ms(snapshot.serverFireProcessingMs)}</dd>
        <dt>sv fire acc/rej</dt><dd>${snapshot.serverFireAcceptedPerSec ?? "-"} / ${snapshot.serverFireRejectedPerSec ?? "-"}</dd>
        <dt>sv alive AI</dt><dd>${snapshot.serverAliveAiCount ?? "-"}</dd>
        <dt>sv targeted/bcast</dt><dd>${snapshot.targetedMsgPerSec ?? "-"} / ${snapshot.broadcastMsgPerSec ?? "-"}</dd>
        <dt>sv ai/sim Hz</dt><dd>${snapshot.aiUpdateHz ?? "-"} / ${snapshot.simulationHz ?? "-"}</dd>
        <dt>tracer act/tot</dt><dd>${snapshot.tracerActiveCount ?? "-"} / ${snapshot.tracerTotalCount ?? "-"}</dd>
        <dt>ai label/s</dt><dd>${fmtNum(snapshot.aiLabelUpdatesPerSec)}</dd>
        <dt>wpn hud/s</dt><dd>${fmtNum(snapshot.weaponHudRendersPerSec)}</dd>
        <dt>hit fb/s</dt><dd>${fmtNum(snapshot.hitFeedbackShowsPerSec)}</dd>
        <dt>targetHp</dt><dd>${snapshot.targetHp ?? "-"}</dd>
        <dt>targetAlive</dt><dd>${snapshot.targetAlive === null ? "-" : String(snapshot.targetAlive)}</dd>
      </dl>
      <div id="debug-charts" class="debug-charts"></div>
      <div class="debug-hint">F3 收起</div>
    `;

    // Recreate charts with fresh canvases after innerHTML replacement
    this.ensureCharts(true);

    // Update charts
    if (this.charts) {
      this.charts.ping.render({ label: "ping ms", color: "#f97316", values: snapshot.pingSeries.getValues(), unit: "ms", maxHint: 200 });
      this.charts.fps.render({ label: "FPS", color: "#22c55e", values: snapshot.fpsSeries.getValues(), unit: "", maxHint: 120 });
      this.charts.fire.render({ label: "fire/s", color: "#ef4444", values: snapshot.fireSendSeries.getValues(), unit: "/s", maxHint: 20 });
      this.charts.tick.render({ label: "tick ms", color: "#3b82f6", values: snapshot.serverTickSeries.getValues(), unit: "ms", maxHint: 50 });
    }
  }

  private handleKeyDown = (e: KeyboardEvent): void => { if (e.code === "F3") { e.preventDefault(); this.expanded = !this.expanded; } };
}

function f(v: string | null): string { return v && v.length > 0 ? v : "-"; }
function ms(v: number | null): string { return v === null ? "-" : `${Math.round(v)}ms`; }
function fmtNum(v: number | null): string { return v === null ? "-" : v.toFixed(1); }
