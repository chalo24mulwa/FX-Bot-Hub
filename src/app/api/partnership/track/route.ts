import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { env } from "@/lib/env";
import { assertSameOrigin, CsrfError } from "@/lib/security/csrf";
import { checkRateLimit, clientIp, RateLimitError } from "@/lib/security/rate-limit";
import { REFERRAL_COOKIE, RECRUIT_COOKIE, VISITOR_COOKIE } from "@/lib/partnership/codes";
import { newVisitorId, recordRecruitVisit, recordReferralVisit } from "@/features/partnership/attribution-service";
import { logger } from "@/lib/logger";

/**
 * Called by <ReferralTracker> when a page is opened with ?ref=CODE (a Partner's
 * referral link) or ?master=CODE (a Master Partner's recruitment link). The
 * code is validated here, server-side; only a valid, active code produces a
 * signed, httpOnly cookie. Same-origin and rate limited, so it can't be driven
 * from another site or used to inflate click counts in bulk.
 */
export async function POST(request: NextRequest) {
  try {
    assertSameOrigin(request);
    await checkRateLimit(clientIp(request), { bucket: "partnership:track", limit: 30, windowSeconds: 60 });

    const body = (await request.json().catch(() => ({}))) as { ref?: unknown; master?: unknown; path?: unknown };
    const path = typeof body.path === "string" && body.path.startsWith("/") ? body.path : "/";
    const session = await auth();
    const viewerUserId = session?.user?.id ?? null;

    const existingVisitor = request.cookies.get(VISITOR_COOKIE)?.value;
    const visitorId = existingVisitor && /^[0-9a-f-]{36}$/.test(existingVisitor) ? existingVisitor : newVisitorId();

    const [ref, recruit] = await Promise.all([
      body.ref ? recordReferralVisit({ code: body.ref, visitorId, path, viewerUserId }) : null,
      body.master ? recordRecruitVisit({ code: body.master, viewerUserId }) : null,
    ]);

    const response = NextResponse.json({ tracked: Boolean(ref || recruit) });
    const base = { httpOnly: true, sameSite: "lax" as const, secure: env.NODE_ENV === "production", path: "/" };
    if (ref) {
      response.cookies.set(REFERRAL_COOKIE, ref.value, { ...base, maxAge: ref.maxAgeSeconds });
      if (visitorId !== existingVisitor) response.cookies.set(VISITOR_COOKIE, visitorId, { ...base, maxAge: ref.maxAgeSeconds });
    }
    if (recruit) response.cookies.set(RECRUIT_COOKIE, recruit.value, { ...base, maxAge: recruit.maxAgeSeconds });
    return response;
  } catch (err) {
    if (err instanceof CsrfError) return NextResponse.json({ error: err.message }, { status: err.status });
    if (err instanceof RateLimitError) return NextResponse.json({ error: err.message }, { status: 429 });
    logger.warn("partnership: track failed", { error: err instanceof Error ? err.message : String(err) });
    return NextResponse.json({ tracked: false });
  }
}
