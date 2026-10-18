import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Redis is not available here: the memory tier is what is under test. (The real module reads server env on import.)
vi.mock("@/lib/redis", () => ({
  redis: {},
  redisReady: () => false,
  withRedisTimeout: <T,>(p: Promise<T>) => p,
  REDIS_FAST_TIMEOUT_MS: 250,
}));

import { cacheInvalidate, cacheWrap, invalidateCachePrefix, __memoryCacheSize } from "./cache";

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-19T10:00:00Z"));
  invalidateCachePrefix(""); // clears everything: every key starts with ""
  delete process.env.CACHE_MEMORY_DISABLED;
});
afterEach(() => {
  vi.useRealTimers();
});

describe("cacheWrap (memory tier)", () => {
  it("computes once within the TTL and serves the cached value after that", async () => {
    const compute = vi.fn(async () => ({ n: 1 }));
    expect(await cacheWrap("t:a", 60, compute)).toEqual({ n: 1 });
    expect(await cacheWrap("t:a", 60, compute)).toEqual({ n: 1 });
    expect(compute).toHaveBeenCalledTimes(1);
  });

  it("keeps keys apart", async () => {
    expect(await cacheWrap("t:x", 60, async () => "x")).toBe("x");
    expect(await cacheWrap("t:y", 60, async () => "y")).toBe("y");
  });

  it("hands every caller its own copy, so a page mutating its data cannot change what the next visitor gets", async () => {
    const first = await cacheWrap("t:clone", 60, async () => ({ items: [{ id: 1, at: new Date("2026-01-01T00:00:00Z") }] }));
    first.items.push({ id: 2, at: new Date(0) });
    const second = await cacheWrap("t:clone", 60, async () => ({ items: [] as { id: number; at: Date }[] }));
    expect(second.items).toHaveLength(1);
    expect(second.items[0].at).toBeInstanceOf(Date); // real Dates survive (no JSON round trip)
  });

  it("serves the stale value at once after the TTL while ONE background refresh runs, then the fresh value", async () => {
    let finishRefresh!: (v: number) => void;
    const compute = vi.fn<() => Promise<number>>().mockResolvedValueOnce(1).mockImplementationOnce(() => new Promise<number>((r) => (finishRefresh = r)));
    expect(await cacheWrap("t:swr", 10, compute)).toBe(1);

    vi.setSystemTime(Date.now() + 11_000); // past fresh, inside the stale window
    expect(await cacheWrap("t:swr", 10, compute)).toBe(1); // stale, instantly, while the refresh is still running
    expect(await cacheWrap("t:swr", 10, compute)).toBe(1);
    expect(compute).toHaveBeenCalledTimes(2); // exactly one refresh, however many callers
    finishRefresh(2);
    await vi.advanceTimersByTimeAsync(0);
    expect(await cacheWrap("t:swr", 10, compute)).toBe(2);
    expect(compute).toHaveBeenCalledTimes(2);
  });

  it("recomputes (and waits) once even the stale window has passed", async () => {
    let version = 1;
    const compute = vi.fn(async () => version);
    await cacheWrap("t:old", 10, compute);
    version = 2;
    vi.setSystemTime(Date.now() + 25_000);
    expect(await cacheWrap("t:old", 10, compute)).toBe(2);
  });

  it("shares one computation between concurrent callers", async () => {
    let resolve!: (v: string) => void;
    const compute = vi.fn(() => new Promise<string>((r) => (resolve = r)));
    const a = cacheWrap("t:inflight", 60, compute);
    const b = cacheWrap("t:inflight", 60, compute);
    resolve("done");
    expect(await Promise.all([a, b])).toEqual(["done", "done"]);
    expect(compute).toHaveBeenCalledTimes(1);
  });

  it("does not cache failures, and keeps serving the stale value if a refresh fails", async () => {
    const failing = vi.fn(async () => {
      throw new Error("db down");
    });
    await expect(cacheWrap("t:err", 60, failing)).rejects.toThrow("db down");
    await expect(cacheWrap("t:err", 60, failing)).rejects.toThrow("db down");
    expect(failing).toHaveBeenCalledTimes(2);

    await cacheWrap("t:keep", 10, async () => "good");
    vi.setSystemTime(Date.now() + 11_000);
    expect(await cacheWrap("t:keep", 10, failing)).toBe("good");
  });

  it("invalidates by prefix and by key", async () => {
    await cacheWrap("product:slug:a", 60, async () => 1);
    await cacheWrap("product:slug:b", 60, async () => 2);
    await cacheWrap("other:x", 60, async () => 3);
    invalidateCachePrefix("product:");
    expect(__memoryCacheSize()).toBe(1);
    await cacheInvalidate("other:x");
    expect(__memoryCacheSize()).toBe(0);
    const compute = vi.fn(async () => 9);
    expect(await cacheWrap("product:slug:a", 60, compute)).toBe(9); // recomputed
  });

  it("is bypassed entirely when CACHE_MEMORY_DISABLED=true", async () => {
    process.env.CACHE_MEMORY_DISABLED = "true";
    const compute = vi.fn(async () => 1);
    await cacheWrap("t:off", 60, compute);
    await cacheWrap("t:off", 60, compute);
    expect(compute).toHaveBeenCalledTimes(2);
    expect(__memoryCacheSize()).toBe(0);
  });

  it("stays bounded", async () => {
    for (let i = 0; i < 700; i++) await cacheWrap(`bound:${i}`, 60, async () => i);
    expect(__memoryCacheSize()).toBeLessThanOrEqual(600);
  });
});
