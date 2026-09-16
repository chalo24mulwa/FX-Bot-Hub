import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";
import { resetPasswordSchema } from "@/lib/validations/auth";
import { resetPassword, InvalidResetTokenError } from "@/features/auth/password-reset-service";
import { checkRateLimit, clientIp, RateLimitError } from "@/lib/security/rate-limit";
import { assertSameOrigin, CsrfError } from "@/lib/security/csrf";

export async function POST(request: NextRequest) {
  try {
    assertSameOrigin(request);
    await checkRateLimit(clientIp(request), { bucket: "auth:reset-password", limit: 10, windowSeconds: 300 });

    const { token, password } = resetPasswordSchema.parse(await request.json());
    await resetPassword(token, password);

    return NextResponse.json({ message: "Your password has been reset." });
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
    if (err instanceof InvalidResetTokenError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    throw err;
  }
}
