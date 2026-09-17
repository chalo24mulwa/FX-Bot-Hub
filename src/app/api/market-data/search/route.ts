import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { checkRateLimit, clientIp, RateLimitError } from "@/lib/security/rate-limit";
import { cacheWrap } from "@/lib/cache";
import { upsertInstrumentsBestEffort } from "@/lib/market-data/instrument-cache";
import { requireProvider, respondWithError } from "../_shared";

const QuerySchema = z.object({ q: z.string().trim().min(1).max(50) });

// Rate-limited (search is the one endpoint a user can trigger rapidly by
// typing) and cached briefly — repeat searches for a popular query
// ("EUR", "AAPL") shouldn't each cost a provider request. Never loads the
// provider's full instrument catalogue; see MarketDataProvider.searchSymbols's
// doc comment in src/lib/market-data/types.ts.
export async function GET(request: NextRequest) {
  try {
    await checkRateLimit(clientIp(request), { bucket: "market-data:search", limit: 30, windowSeconds: 60 });

    const parsed = QuerySchema.safeParse({ q: request.nextUrl.searchParams.get("q") });
    if (!parsed.success) {
      return NextResponse.json({ error: "Query parameter 'q' is required." }, { status: 400 });
    }

    const provider = requireProvider();
    const query = parsed.data.q.toLowerCase();
    const results = await cacheWrap(`market-data:search:${provider.key}:${query}`, 30, () => provider.searchSymbols(query));

    void upsertInstrumentsBestEffort(provider.key, results);

    return NextResponse.json({ results });
  } catch (err) {
    if (err instanceof RateLimitError) {
      return NextResponse.json({ error: err.message }, { status: err.status, headers: { "Retry-After": String(err.retryAfterSeconds) } });
    }
    return respondWithError(err);
  }
}
