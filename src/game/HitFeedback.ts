import { FIRE_FEEDBACK_DURATION_MS } from "../../shared/constants";

export class HitFeedback {
  private root: HTMLElement;
  private element: HTMLDivElement;
  private expiresAt = 0;
  private showCounter = 0;
  private lastCounterResetAt = 0;

  constructor(root: HTMLElement) {
    this.root = root;
    this.element = document.createElement("div");
    this.element.className = "hit-feedback";
    this.element.textContent = "";
    this.root.appendChild(this.element);
  }

  show(message: string): void {
    this.element.textContent = message;
    this.element.classList.add("visible");
    this.expiresAt = performance.now() + FIRE_FEEDBACK_DURATION_MS;
    const now = performance.now();
    if (now - this.lastCounterResetAt >= 1000) { this.showCounter = 0; this.lastCounterResetAt = now; }
    this.showCounter++;
  }

  update(now: number): void {
    if (this.expiresAt > 0 && now >= this.expiresAt) {
      this.element.classList.remove("visible");
      this.element.textContent = "";
      this.expiresAt = 0;
    }
  }

  getDebugStats() { return { showsPerSecond: this.showCounter, active: this.element.classList.contains("visible") }; }

  dispose(): void { this.element.remove(); }
}
