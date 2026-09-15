import { NextRequest, NextResponse } from "next/server";
import { requireSession, withAuthorization } from "@/lib/authorization";
import { assertSameOrigin } from "@/lib/security/csrf";
import { checkRateLimit, clientIp } from "@/lib/security/rate-limit";
import { checkoutCart, CheckoutError } from "@/features/checkout/checkout-service";

export async function POST(request: NextRequest) {
  return withAuthorization(async () => {
    assertSameOrigin(request);
    const session = await requireSession();
    await checkRateLimit(clientIp(request), { bucket: "checkout", limit: 10, windowSeconds: 60 });

    try {
      const idempotencyKey = request.headers.get("idempotency-key") ?? undefined;
      const result = await checkoutCart(session.user.id, session.user.email!, idempotencyKey);
      return NextResponse.json(result);
    } catch (err) {
      if (err instanceof CheckoutError) {
        return NextResponse.json({ error: err.message }, { status: err.status });
      }
      throw err;
    }
  });
}
