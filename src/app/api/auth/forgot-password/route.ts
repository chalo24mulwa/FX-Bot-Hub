import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";
import { forgotPasswordSchema } from "@/lib/validations/auth";
import { requestPasswordReset } from "@/features/auth/password-reset-service";
import { checkRateLimit, clientIp, RateLimitError } from "@/lib/security/rate-limit";
import { assertSameOrigin, CsrfError } from "@/lib/security/csrf";

export async function POST(request: NextRequest) {
  try {
    assertSameOrigin(request);
    const { email } = forgotPasswordSchema.parse(await request.json());

    // Limited by both the caller's IP (catches one attacker cycling
    // through many emails) and the submitted email (catches repeated
    // requests against one target's inbox) — same posture as sign-in's
    // rate limit in src/lib/auth.ts.
    await checkRateLimit(clientIp(request), { bucket: "auth:forgot-password:ip", limit: 10, windowSeconds: 300 });
    await checkRateLimit(email.toLowerCase(), { bucket: "auth:forgot-password:email", limit: 3, windowSeconds: 900 });

    await requestPasswordReset(email);

    // Always this exact response, whether or not the email matched a
    // resettable account — see requestPasswordReset's doc comment. Never
    // branch this response on the lookup result.
    return NextResponse.json({
      message: "If an account exists for that email, we've sent password reset instructions.",
    });
  } catch (err) {
    if (err instanceof ZodError) {
      return NextResponse.json({ error: err.flatten() }, { status: 400 });
    }
    if (err instanceof CsrfError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    if (err instanceof RateLimitError) {
      return NextResponse.json(
        { error: err.message },
        { status: 429, headers: { "Retry-After": String(err.retryAfterSeconds) } }
      );
    }
    throw err;
  }
}
