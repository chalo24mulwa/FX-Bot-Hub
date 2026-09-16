import { env } from "@/lib/env";
import { logger } from "@/lib/logger";
import type { CalendarEventInput, CalendarProvider } from "./types";
import { validateRawEvents, toCalendarEventInput } from "./authorized-provider-mapping";

// Real integration against a licensed economic-calendar API — Trading
// Economics' Calendar endpoint (https://developer.tradingeconomics.com/
// docs#calendar) by default, selected because it's a well-known,
// documented, commercially-licensable source built for exactly this
// purpose (never Forex Factory — see CLAUDE.md's data-sourcing rule).
// `ECONOMIC_CALENDAR_API_URL` can point at any provider that returns this
// same shape (or a proxy that translates to it); swapping to a genuinely
// different provider's response shape means changing `RawEventSchema` and
// `toCalendarEventInput` in ./authorized-provider-mapping.ts, not the
// CalendarProvider contract itself. Request/response mapping lives in that
// sibling file (pure, no env/DB dependency, unit-tested there) — this file
// is only the HTTP/config-dependent half.
//
// Requires `ECONOMIC_CALENDAR_API_KEY` (a real, licensed API key) and
// `ECONOMIC_CALENDAR_PROVIDER=authorized` — see src/lib/env.ts and
// docs/ENVIRONMENT.md. Until a real key is configured, every method below
// throws a clear "not configured" error rather than silently returning
// nothing, so a misconfigured deploy fails loudly at sync time (logged,
// caught by sync-service's per-source try/catch — see CLAUDE.md's Phase 3
// "one provider failing doesn't abort the others" note) instead of
// quietly serving an empty calendar.
//
// NOTE: this has been validated against the documented response shape and
// exercised in tests with a mocked HTTP layer
// (authorized-provider-mapping.test.ts), not against a live Trading
// Economics account — this environment holds no real API key. Verify
// against a real key/sandbox before enabling
// ECONOMIC_CALENDAR_PROVIDER=authorized in production.

const MAX_RETRY_ATTEMPTS = 3;
const RETRY_BASE_DELAY_MS = 500;

/** HTTP-level retry for a single sync pass — distinct from BullMQ's
 * job-level retry (SYNC_JOB_OPTIONS: 3 attempts, 30s backoff), which
 * re-runs the *whole* job. This retries only a single transient
 * request (network blip, 5xx) within one job attempt, so a job doesn't
 * fail and wait 30s over one flaky response. Never retries a 4xx (bad
 * request/auth) — that's a configuration error, not a transient one. */
async function fetchWithRetry(url: string): Promise<Response> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= MAX_RETRY_ATTEMPTS; attempt++) {
    try {
      const res = await fetch(url);
      if (res.ok) return res;
      if (res.status >= 400 && res.status < 500) {
        throw new Error(`authorized calendar provider request failed (${res.status}): ${await safeText(res)}`);
      }
      lastError = new Error(`authorized calendar provider request failed (${res.status})`);
    } catch (err) {
      lastError = err;
    }
    if (attempt < MAX_RETRY_ATTEMPTS) {
      const delay = RETRY_BASE_DELAY_MS * 2 ** (attempt - 1);
      await new Promise((resolve) => setTimeout(resolve, delay));
      logger.warn("authorized calendar provider retrying", { attempt, delay });
    }
  }
  throw lastError instanceof Error ? lastError : new Error("authorized calendar provider request failed");
}

async function safeText(res: Response): Promise<string> {
  try {
    return await res.text();
  } catch {
    return "";
  }
}

function formatDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function requireConfigured(): { apiKey: string; apiUrl: string } {
  if (!env.ECONOMIC_CALENDAR_API_KEY) {
    throw new Error(
      "AuthorizedCalendarProvider is not configured: set ECONOMIC_CALENDAR_API_KEY to a real, " +
        "licensed API key before enabling the 'authorized' DataSource at /admin/data-sources."
    );
  }
  return { apiKey: env.ECONOMIC_CALENDAR_API_KEY, apiUrl: env.ECONOMIC_CALENDAR_API_URL };
}

export class AuthorizedCalendarProvider implements CalendarProvider {
  readonly key = "authorized";

  async getEvents({ from, to }: { from: Date; to: Date }): Promise<CalendarEventInput[]> {
    const { apiKey, apiUrl } = requireConfigured();
    const url = `${apiUrl}/calendar?d1=${formatDate(from)}&d2=${formatDate(to)}&c=${encodeURIComponent(apiKey)}&f=json`;
    const res = await fetchWithRetry(url);
    const payload = await res.json();
    const { valid, rejected } = validateRawEvents(payload);
    if (rejected > 0) {
      logger.warn("authorized calendar provider rejected malformed rows", { rejected, kept: valid.length });
    }
    return valid.map(toCalendarEventInput);
  }

  async getEvent(externalId: string): Promise<CalendarEventInput | null> {
    const { apiKey, apiUrl } = requireConfigured();
    const id = externalId.replace(/^authorized:/, "");
    const url = `${apiUrl}/calendar/id/${encodeURIComponent(id)}?c=${encodeURIComponent(apiKey)}&f=json`;
    const res = await fetchWithRetry(url);
    const payload = await res.json();
    const { valid } = validateRawEvents(payload);
    return valid.length > 0 ? toCalendarEventInput(valid[0]) : null;
  }

  async getHistoricalData(currency: string, title: string, limit = 12): Promise<CalendarEventInput[]> {
    const { apiKey, apiUrl } = requireConfigured();
    // Best-effort: the provider's history is keyed by country/indicator,
    // not currency/title directly, so this bounds the lookback (2 years)
    // and filters client-side rather than requesting unbounded history —
    // see this file's doc comment re: not yet exercised against a live
    // account. Treat as a template to firm up once real credentials and a
    // confirmed historical-lookup endpoint shape are available.
    const to = new Date();
    const from = new Date(to.getTime() - 2 * 365 * 86_400_000);
    const url = `${apiUrl}/calendar?d1=${formatDate(from)}&d2=${formatDate(to)}&c=${encodeURIComponent(apiKey)}&f=json`;
    const res = await fetchWithRetry(url);
    const payload = await res.json();
    const { valid } = validateRawEvents(payload);
    return valid
      .filter((row) => (row.Currency ?? "").toUpperCase() === currency.toUpperCase() && row.Event === title)
      .sort((a, b) => new Date(b.Date).getTime() - new Date(a.Date).getTime())
      .slice(0, Math.min(limit, 50))
      .map(toCalendarEventInput);
  }
}
