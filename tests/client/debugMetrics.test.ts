import { describe, expect, it } from "vitest";
import { MetricSeries, MetricWindowCounter } from "../../src/game/DebugMetrics";

describe("MetricSeries", () => {
  it("retains fixed length", () => {
    const s = new MetricSeries(3);
    s.push(1); s.push(2); s.push(3); s.push(4);
    expect(s.getValues()).toEqual([2, 3, 4]);
  });

  it("computes average min max correctly", () => {
    const s = new MetricSeries(10);
    [2, 4, 6].forEach(v => s.push(v));
    expect(s.getAverage()).toBeCloseTo(4);
    expect(s.getMin()).toBe(2);
    expect(s.getMax()).toBe(6);
  });

  it("computes jitter", () => {
    const s = new MetricSeries(10);
    [10, 20, 30].forEach(v => s.push(v));
    expect(s.getJitter()).toBeCloseTo(10);
  });

  it("returns null for empty series", () => {
    const s = new MetricSeries(10);
    expect(s.getLatest()).toBeNull();
    expect(s.getAverage()).toBeNull();
  });
});

describe("MetricWindowCounter", () => {
  it("counts events in window", () => {
    const c = new MetricWindowCounter(1000);
    c.increment(1000); c.increment(1100); c.increment(1200);
    // All within 200ms of now=1300, should be 3/sec
    expect(c.getRate(1300)).toBeCloseTo(3);
  });

  it("prunes old events", () => {
    const c = new MetricWindowCounter(1000);
    c.increment(0);
    expect(c.getRate(2000)).toBe(0);
  });
});
