import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { checkRateLimit, clientIp, RateLimitError } from "@/lib/security/rate-limit";
import { cacheWrap } from "@/lib/cache";
import { requireProvider, respondWithError } from "../_shared";

const QuerySchema = z.object({ symbol: z.string().trim().min(1).max(20) });

export async function GET(request: NextRequest) {
  try {
    await checkRateLimit(clientIp(request), { bucket: "market-data:resolve", limit: 60, windowSeconds: 60 });

    const parsed = QuerySchema.safeParse({ symbol: request.nextUrl.searchParams.get("symbol") });
    if (!parsed.success) {
      return NextResponse.json({ error: "Query parameter 'symbol' is required." }, { status: 400 });
    }

    const provider = requireProvider();
    const instrument = await cacheWrap(`market-data:resolve:${provider.key}:${parsed.data.symbol.toUpperCase()}`, 300, () =>
      provider.resolveSymbol(parsed.data.symbol)
    );

    if (!instrument) {
      return NextResponse.json({ error: `Symbol '${parsed.data.symbol}' not found.` }, { status: 404 });
    }
    return NextResponse.json({ instrument });
  } catch (err) {
    if (err instanceof RateLimitError) {
      return NextResponse.json({ error: err.message }, { status: err.status, headers: { "Retry-After": String(err.retryAfterSeconds) } });
    }
    return respondWithError(err);
  }
}
