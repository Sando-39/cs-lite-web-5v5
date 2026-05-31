import type { ConnectionStatus } from "../network/NetworkClient";

export type DebugSnapshot = {
  roomId: string | null;
  sessionId: string | null;
  connectionStatus: ConnectionStatus;
  playerCount: number;
  remotePlayerCount: number;
  localX: number;
  localY: number;
  localZ: number;
  localRotationY: number;
  moveSendHzTarget: number;
  lastMoveSentMsAgo: number | null;
  remoteUpdateAgeMs: number | null;
  pingEstimateMs: number | null;
};

export class DebugHud {
  private root: HTMLElement;
  private expanded = false;

  constructor(root: HTMLElement) {
    this.root = root;
  }

  attach(): void {
    window.addEventListener("keydown", this.handleKeyDown);
  }

  detach(): void {
    window.removeEventListener("keydown", this.handleKeyDown);
  }

  render(snapshot: DebugSnapshot): void {
    const container = this.root.querySelector<HTMLDivElement>("#debug-hud");

    if (!container) {
      return;
    }

    if (!this.expanded) {
      container.innerHTML = `<strong>Debug:</strong> F3 展开`;
      return;
    }

    container.innerHTML = `
      <strong>Debug</strong>
      <dl class="debug-grid">
        <dt>roomId</dt><dd>${this.format(snapshot.roomId)}</dd>
        <dt>sessionId</dt><dd>${this.format(snapshot.sessionId)}</dd>
        <dt>status</dt><dd>${snapshot.connectionStatus}</dd>
        <dt>players</dt><dd>${snapshot.playerCount}</dd>
        <dt>remote</dt><dd>${snapshot.remotePlayerCount}</dd>
        <dt>local</dt><dd>${snapshot.localX.toFixed(2)}, ${snapshot.localY.toFixed(2)}, ${snapshot.localZ.toFixed(2)}</dd>
        <dt>rotY</dt><dd>${snapshot.localRotationY.toFixed(3)}</dd>
        <dt>sendHz</dt><dd>${snapshot.moveSendHzTarget}</dd>
        <dt>lastSend</dt><dd>${this.formatMs(snapshot.lastMoveSentMsAgo)}</dd>
        <dt>remoteAge</dt><dd>${this.formatMs(snapshot.remoteUpdateAgeMs)}</dd>
        <dt>ping</dt><dd>${this.formatMs(snapshot.pingEstimateMs)}</dd>
      </dl>
      <div class="debug-hint">F3 收起</div>
    `;
  }

  private handleKeyDown = (event: KeyboardEvent): void => {
    if (event.code !== "F3") {
      return;
    }

    event.preventDefault();
    this.expanded = !this.expanded;
  };

  private format(value: string | null): string {
    return value && value.length > 0 ? value : "-";
  }

  private formatMs(value: number | null): string {
    return value === null ? "-" : `${Math.round(value)}ms`;
  }
}
