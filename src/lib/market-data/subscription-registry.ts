// Reference-counted subscription bookkeeping, shared by any provider whose
// upstream connection (a WebSocket, typically) should be opened once per
// distinct key and shared across every caller subscribed to that same key
// — not one upstream connection per browser tab. Pure/in-memory so the
// open/close-on-last-unsubscribe logic (easy to get off-by-one) is
// unit-testable without a real socket — see subscription-registry.test.ts.
// The provider (see twelvedata-provider.ts) owns actually opening/closing
// the upstream connection; this only decides *when* to.

export interface SubscribeOutcome {
  subscriptionId: string;
  /** True the first time this key gets a subscriber — the caller should
   * open the upstream connection/subscription now. */
  isFirstForKey: boolean;
}

export interface UnsubscribeOutcome {
  found: boolean;
  key: string | null;
  /** True when this was the last subscriber for that key — the caller
   * should close/unsubscribe the upstream connection now. */
  wasLastForKey: boolean;
}

export class RefCountedSubscriptionRegistry<TCallback> {
  private nextId = 1;
  private readonly callbacksByKey = new Map<string, Map<string, TCallback>>();
  private readonly keyBySubscriptionId = new Map<string, string>();

  subscribe(key: string, callback: TCallback): SubscribeOutcome {
    const subscriptionId = `sub_${this.nextId++}`;
    let bucket = this.callbacksByKey.get(key);
    const isFirstForKey = !bucket;
    if (!bucket) {
      bucket = new Map();
      this.callbacksByKey.set(key, bucket);
    }
    bucket.set(subscriptionId, callback);
    this.keyBySubscriptionId.set(subscriptionId, key);
    return { subscriptionId, isFirstForKey };
  }

  unsubscribe(subscriptionId: string): UnsubscribeOutcome {
    const key = this.keyBySubscriptionId.get(subscriptionId);
    if (!key) return { found: false, key: null, wasLastForKey: false };

    this.keyBySubscriptionId.delete(subscriptionId);
    const bucket = this.callbacksByKey.get(key);
    bucket?.delete(subscriptionId);

    const wasLastForKey = !bucket || bucket.size === 0;
    if (wasLastForKey) this.callbacksByKey.delete(key);

    return { found: true, key, wasLastForKey };
  }

  callbacksFor(key: string): TCallback[] {
    return Array.from(this.callbacksByKey.get(key)?.values() ?? []);
  }

  activeKeyCount(): number {
    return this.callbacksByKey.size;
  }
}
