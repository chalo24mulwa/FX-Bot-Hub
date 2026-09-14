import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";
import { signUpSchema } from "@/lib/validations/auth";
import { registerUser } from "@/server/services/auth-service";
import { checkRateLimit, clientIp, RateLimitError } from "@/lib/security/rate-limit";
import { assertSameOrigin, CsrfError } from "@/lib/security/csrf";

export async function POST(request: NextRequest) {
  try {
    assertSameOrigin(request);
    await checkRateLimit(clientIp(request), { bucket: "auth:register", limit: 5, windowSeconds: 60 * 15 });

    const body = signUpSchema.parse(await request.json());
    const user = await registerUser(body);
    return NextResponse.json(user, { status: 201 });
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
    if (err instanceof Error) {
      return NextResponse.json({ error: err.message }, { status: 409 });
    }
    throw err;
  }
}
