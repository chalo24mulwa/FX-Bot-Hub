import { describe, expect, it } from "vitest";
import { RefCountedSubscriptionRegistry } from "./subscription-registry";

describe("RefCountedSubscriptionRegistry", () => {
  it("marks the first subscriber for a key as isFirstForKey", () => {
    const reg = new RefCountedSubscriptionRegistry<() => void>();
    const { isFirstForKey } = reg.subscribe("EUR/USD:1m", () => {});
    expect(isFirstForKey).toBe(true);
  });

  it("does not mark a second subscriber to the same key as first", () => {
    const reg = new RefCountedSubscriptionRegistry<() => void>();
    reg.subscribe("EUR/USD:1m", () => {});
    const { isFirstForKey } = reg.subscribe("EUR/USD:1m", () => {});
    expect(isFirstForKey).toBe(false);
  });

  it("treats different keys independently", () => {
    const reg = new RefCountedSubscriptionRegistry<() => void>();
    reg.subscribe("EUR/USD:1m", () => {});
    const { isFirstForKey } = reg.subscribe("GBP/USD:1m", () => {});
    expect(isFirstForKey).toBe(true);
  });

  it("reports wasLastForKey only when the final subscriber for that key unsubscribes", () => {
    const reg = new RefCountedSubscriptionRegistry<() => void>();
    const first = reg.subscribe("EUR/USD:1m", () => {});
    const second = reg.subscribe("EUR/USD:1m", () => {});

    const outcome1 = reg.unsubscribe(first.subscriptionId);
    expect(outcome1.wasLastForKey).toBe(false);
    expect(outcome1.key).toBe("EUR/USD:1m");

    const outcome2 = reg.unsubscribe(second.subscriptionId);
    expect(outcome2.wasLastForKey).toBe(true);
  });

  it("returns found:false for an unknown subscription id", () => {
    const reg = new RefCountedSubscriptionRegistry<() => void>();
    const outcome = reg.unsubscribe("does-not-exist");
    expect(outcome.found).toBe(false);
  });

  it("delivers callbacksFor only the callbacks registered under that key", () => {
    const reg = new RefCountedSubscriptionRegistry<string>();
    reg.subscribe("EUR/USD:1m", "a");
    reg.subscribe("EUR/USD:1m", "b");
    reg.subscribe("GBP/USD:1m", "c");
    expect(reg.callbacksFor("EUR/USD:1m").sort()).toEqual(["a", "b"]);
    expect(reg.callbacksFor("GBP/USD:1m")).toEqual(["c"]);
  });

  it("tracks activeKeyCount as keys gain and lose their last subscriber", () => {
    const reg = new RefCountedSubscriptionRegistry<() => void>();
    const a = reg.subscribe("EUR/USD:1m", () => {});
    reg.subscribe("GBP/USD:1m", () => {});
    expect(reg.activeKeyCount()).toBe(2);
    reg.unsubscribe(a.subscriptionId);
    expect(reg.activeKeyCount()).toBe(1);
  });
});
