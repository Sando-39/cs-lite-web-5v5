export class HudUpdateGate<T> {
  private lastValue: T | null = null;
  private lastUpdateAt = 0;

  constructor(private readonly minIntervalMs: number, private readonly equals: (a: T, b: T) => boolean) {}

  shouldUpdate(value: T, now: number): boolean {
    if (this.lastValue === null) { this.lastValue = value; this.lastUpdateAt = now; return true; }
    if (!this.equals(this.lastValue, value)) { this.lastValue = value; this.lastUpdateAt = now; return true; }
    if (now - this.lastUpdateAt >= this.minIntervalMs) { this.lastUpdateAt = now; return true; }
    return false;
  }

  forceNext(): void { this.lastValue = null; this.lastUpdateAt = 0; }
}
