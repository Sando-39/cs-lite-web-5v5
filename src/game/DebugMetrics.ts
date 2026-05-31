export class MetricSeries {
  private values: number[] = [];
  constructor(private readonly maxPoints: number) {}

  push(value: number): void {
    this.values.push(value);
    if (this.values.length > this.maxPoints) this.values.shift();
  }

  getValues(): number[] { return [...this.values]; }
  getLatest(): number | null { return this.values.length > 0 ? this.values[this.values.length - 1] : null; }

  getAverage(): number | null {
    if (this.values.length === 0) return null;
    return this.values.reduce((s, v) => s + v, 0) / this.values.length;
  }

  getMin(): number | null { return this.values.length > 0 ? Math.min(...this.values) : null; }
  getMax(): number | null { return this.values.length > 0 ? Math.max(...this.values) : null; }

  getJitter(): number | null {
    if (this.values.length < 2) return null;
    let total = 0;
    for (let i = 1; i < this.values.length; i++) total += Math.abs(this.values[i] - this.values[i - 1]);
    return total / (this.values.length - 1);
  }
}

export class MetricWindowCounter {
  private events: number[] = [];
  constructor(private readonly windowMs = 1000) {}

  increment(now: number): void { this.events.push(now); this.prune(now); }

  getRate(now: number): number {
    this.prune(now);
    return this.events.length / (this.windowMs / 1000);
  }

  private prune(now: number): void {
    const cutoff = now - this.windowMs;
    this.events = this.events.filter(t => t >= cutoff);
  }
}
