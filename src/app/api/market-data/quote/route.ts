import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { checkRateLimit, clientIp, RateLimitError } from "@/lib/security/rate-limit";
import { cacheWrap } from "@/lib/cache";
import { requireProvider, respondWithError } from "../_shared";

const QuerySchema = z.object({ symbol: z.string().trim().min(1).max(20) });

export async function GET(request: NextRequest) {
  try {
    await checkRateLimit(clientIp(request), { bucket: "market-data:quote", limit: 60, windowSeconds: 60 });

    const parsed = QuerySchema.safeParse({ symbol: request.nextUrl.searchParams.get("symbol") });
    if (!parsed.success) {
      return NextResponse.json({ error: "Query parameter 'symbol' is required." }, { status: 400 });
    }

    const provider = requireProvider();
    // Short TTL — this is a fallback/initial-paint value only; the SSE
    // stream (see /stream/route.ts) is what keeps the price live after
    // that, so this doesn't need to be near-real-time itself.
    const quote = await cacheWrap(`market-data:quote:${provider.key}:${parsed.data.symbol.toUpperCase()}`, 5, () =>
      provider.getLatestQuote(parsed.data.symbol)
    );

    if (!quote) {
      return NextResponse.json({ error: `No quote available for '${parsed.data.symbol}'.` }, { status: 404 });
    }
    return NextResponse.json({ quote });
  } catch (err) {
    if (err instanceof RateLimitError) {
      return NextResponse.json({ error: err.message }, { status: err.status, headers: { "Retry-After": String(err.retryAfterSeconds) } });
    }
    return respondWithError(err);
  }
}
