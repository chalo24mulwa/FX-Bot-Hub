import { NextRequest, NextResponse } from "next/server";
import { assertSameOrigin, CsrfError } from "@/lib/security/csrf";
import { checkRateLimit, clientIp, RateLimitError } from "@/lib/security/rate-limit";
import { isCtaPlacement } from "@/lib/partnership/cta";
import { track } from "@/lib/analytics/track";

/**
 * Counts clicks on "Be Our Partner" calls to action, by placement only — no
 * user id, IP or URL is stored. Same-origin and rate-limited; an unknown
 * placement is ignored. Always answers 204 so a tracking hiccup never matters
 * to the visitor.
 */
export async function POST(request: NextRequest) {
  try {
    assertSameOrigin(request);
    await checkRateLimit(clientIp(request), { bucket: "partnership:cta", limit: 60, windowSeconds: 60 });
    const body = (await request.json().catch(() => ({}))) as { placement?: unknown };
    if (isCtaPlacement(body.placement)) await track({ type: "PARTNERSHIP_CTA_CLICK", metadata: { placement: body.placement } });
  } catch (err) {
    if (err instanceof CsrfError) return NextResponse.json({ error: err.message }, { status: err.status });
    if (err instanceof RateLimitError) return new NextResponse(null, { status: 204 });
  }
  return new NextResponse(null, { status: 204 });
}
