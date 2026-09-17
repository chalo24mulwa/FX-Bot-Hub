import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import type { InstrumentSummary } from "./types";

/**
 * Best-effort persistence of instruments a search/resolve call already
 * returned — never awaited on the request path that serves the user (the
 * search API route fires this with `void`), since the DB write isn't what
 * the caller is waiting on and shouldn't add latency or a failure mode to
 * it (same "fire-and-forget, never on the critical path" posture as
 * enqueueEmail — see CLAUDE.md's provider-abstractions section). This is
 * a cache, not a source of truth: it exists so a repeated search/the
 * default-instrument lookup can skip a provider round-trip, not to build
 * a complete instrument catalogue up front (see the Instrument model's
 * schema comment).
 */
export async function upsertInstrumentsBestEffort(providerKey: string, instruments: InstrumentSummary[]): Promise<void> {
  if (instruments.length === 0) return;
  try {
    await db.$transaction(
      instruments.map((instrument) =>
        db.instrument.upsert({
          where: { providerKey_externalSymbol: { providerKey, externalSymbol: instrument.symbol } },
          update: {
            displaySymbol: instrument.symbol,
            name: instrument.name,
            assetClass: instrument.assetClass,
            exchange: instrument.exchange,
            currency: instrument.currency,
            lastSyncedAt: new Date(),
          },
          create: {
            providerKey,
            externalSymbol: instrument.symbol,
            displaySymbol: instrument.symbol,
            name: instrument.name,
            assetClass: instrument.assetClass,
            exchange: instrument.exchange,
            currency: instrument.currency,
          },
        })
      )
    );
  } catch (err) {
    logger.warn("instrument cache upsert failed", { error: err instanceof Error ? err.message : String(err) });
  }
}
