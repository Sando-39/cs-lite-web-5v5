import { NetworkClient, type ConnectionStatus } from "../network/NetworkClient";

export type StartGameCallback = (network: NetworkClient) => void;

export class App {
  private root: HTMLDivElement;
  private network: NetworkClient;
  private status: ConnectionStatus = "idle";
  private errorMessage = "";
  private roomCode = "";
  private startGame: StartGameCallback;

  constructor(root: HTMLDivElement, startGame: StartGameCallback) {
    this.root = root;
    this.startGame = startGame;
    this.network = new NetworkClient({
      onStatusChange: (status) => {
        this.status = status;
        this.render();
      },
      onError: (message) => {
        this.errorMessage = message;
        this.render();
      },
      onPlayerLeft: () => undefined
    });
  }

  mount(): void {
    this.render();
  }

  private render(): void {
    this.root.innerHTML = `
      <main class="shell">
        <section class="panel">
          <p class="eyebrow">v0.1 公网联机骨架版</p>
          <h1>CS-Lite Web</h1>
          <p class="lead">
            创建房间，把房间码发给朋友。两个人进入同一个 3D 测试场景后，可以互相看到移动。
          </p>

          <div class="actions">
            <button id="create-room" class="primary" type="button">
              创建房间
            </button>

            <label class="field">
              <span>房间码</span>
              <input id="room-code" value="${this.escapeHtml(this.roomCode)}" placeholder="输入朋友发来的房间码" />
            </label>

            <button id="join-room" class="secondary" type="button">
              加入房间
            </button>
          </div>

          <div class="status">
            <strong>连接状态：</strong>${this.getStatusLabel()}
          </div>

          ${
            this.errorMessage
              ? `<div class="error" role="alert">${this.escapeHtml(this.errorMessage)}</div>`
              : ""
          }

          <p class="fine-print">
            v0.1 不包含射击、AI、回合和比分，只验证公网房间与移动同步。
          </p>
        </section>
      </main>
    `;

    this.bindEvents();
  }

  private bindEvents(): void {
    const createButton = this.root.querySelector<HTMLButtonElement>("#create-room");
    const joinButton = this.root.querySelector<HTMLButtonElement>("#join-room");
    const roomInput = this.root.querySelector<HTMLInputElement>("#room-code");

    createButton?.addEventListener("click", () => {
      void this.createRoom();
    });

    joinButton?.addEventListener("click", () => {
      this.roomCode = roomInput?.value ?? "";
      void this.joinRoom(this.roomCode);
    });

    roomInput?.addEventListener("input", () => {
      this.roomCode = roomInput.value;
      this.errorMessage = "";
    });
  }

  private async createRoom(): Promise<void> {
    this.errorMessage = "";
    await this.network.createRoom();

    if (this.network.roomId) {
      this.startGame(this.network);
    }
  }

  private async joinRoom(roomId: string): Promise<void> {
    this.errorMessage = "";
    await this.network.joinRoom(roomId);

    if (this.network.roomId) {
      this.startGame(this.network);
    }
  }

  private getStatusLabel(): string {
    switch (this.status) {
      case "connecting":
        return "连接中";
      case "connected":
        return "已连接";
      case "disconnected":
        return "连接断开";
      case "idle":
        return "未连接";
    }
  }

  private escapeHtml(value: string): string {
    return value
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }
}
