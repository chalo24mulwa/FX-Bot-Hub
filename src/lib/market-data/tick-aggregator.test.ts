import { describe, expect, it } from "vitest";
import { bucketStart, TickAggregator } from "./tick-aggregator";

describe("bucketStart", () => {
  it("floors to the interval boundary", () => {
    expect(bucketStart(125, "1m")).toBe(120);
    expect(bucketStart(3661, "1h")).toBe(3600);
  });

  it("returns the same bucket for two timestamps inside one interval", () => {
    expect(bucketStart(100, "5m")).toBe(bucketStart(299, "5m"));
  });

  it("returns different buckets across an interval boundary", () => {
    expect(bucketStart(299, "5m")).not.toBe(bucketStart(300, "5m"));
  });
});

describe("TickAggregator", () => {
  it("starts a new bar on the first tick", () => {
    const agg = new TickAggregator("1m");
    const { bar, isNewBar } = agg.ingestTick(1.085, 1000);
    expect(isNewBar).toBe(true);
    expect(bar).toEqual({ time: bucketStart(1000, "1m"), open: 1.085, high: 1.085, low: 1.085, close: 1.085 });
  });

  it("updates high/low/close in place for ticks within the same bucket", () => {
    const agg = new TickAggregator("1m");
    agg.ingestTick(1.085, 1000);
    const { bar, isNewBar } = agg.ingestTick(1.09, 1010);
    expect(isNewBar).toBe(false);
    expect(bar.open).toBe(1.085);
    expect(bar.high).toBe(1.09);
    expect(bar.low).toBe(1.085);
    expect(bar.close).toBe(1.09);
  });

  it("tracks low correctly across multiple ticks", () => {
    const agg = new TickAggregator("1m");
    agg.ingestTick(1.085, 1000);
    agg.ingestTick(1.09, 1005);
    const { bar } = agg.ingestTick(1.08, 1010);
    expect(bar.low).toBe(1.08);
    expect(bar.high).toBe(1.09);
    expect(bar.close).toBe(1.08);
  });

  it("starts a new bar once a tick crosses into the next bucket", () => {
    const agg = new TickAggregator("1m");
    agg.ingestTick(1.085, 1000);
    const { bar, isNewBar } = agg.ingestTick(1.1, 1065);
    expect(isNewBar).toBe(true);
    expect(bar).toEqual({ time: bucketStart(1065, "1m"), open: 1.1, high: 1.1, low: 1.1, close: 1.1 });
  });
});
