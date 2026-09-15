import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { handleWebhook } from "@/lib/payments/payment-service";
import { completePaidOrder, markOrderFailed } from "@/features/checkout/checkout-service";
import { checkRepeatedPaymentFailures } from "@/lib/security/fraud";
import { recordSecurityEvent } from "@/repositories/security-event-repository";
import { recordAuditLog } from "@/repositories/audit-log-repository";
import { enqueueEmail } from "@/jobs/send-email";
import { buildPaymentFailedEmail } from "@/emails/templates";

const siteUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

/**
 * The one inbound endpoint every payment provider posts to. Per
 * PRODUCTION REQUIREMENT (see CLAUDE.md): a frontend "success" redirect is
 * never treated as proof of payment — this webhook (or an explicit
 * verifyPayment() call) is the only trusted confirmation path.
 *
 * No requireSession()/assertSameOrigin() here — a payment provider isn't a
 * signed-in browser session and won't send an Origin header a same-site
 * check would accept. Trust instead comes from provider.parseWebhook()
 * verifying the payload's signature (see src/lib/payments/*-provider.ts);
 * an invalid signature makes parseWebhook throw, which this route turns
 * into a 400 and a logged SecurityEvent, never into processed payment
 * state.
 */
export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  const headers = Object.fromEntries(request.headers.entries());

  let result;
  try {
    result = await handleWebhook(rawBody, headers);
  } catch (err) {
    await recordSecurityEvent({
      type: "WEBHOOK_SIGNATURE_INVALID",
      severity: "HIGH",
      metadata: { error: err instanceof Error ? err.message : String(err) },
    });
    return NextResponse.json({ error: "Invalid webhook payload." }, { status: 400 });
  }

  if (result.duplicate) {
    // Already processed — acknowledge so the provider stops retrying,
    // without touching order/payment state again.
    return NextResponse.json({ received: true, duplicate: true });
  }

  if (!result.payment) {
    await recordSecurityEvent({
      type: "OTHER",
      severity: "MEDIUM",
      metadata: { note: "Webhook for unknown payment", providerReference: result.event?.providerReference },
    });
    return NextResponse.json({ received: true, matched: false });
  }

  await recordAuditLog({
    actorId: null,
    action: `payment.webhook.${result.event!.status}`,
    entityType: "Payment",
    entityId: result.payment.id,
    metadata: { orderId: result.payment.orderId },
  });

  if (result.event!.status === "succeeded") {
    await completePaidOrder(result.payment.orderId);
  } else if (result.event!.status === "failed") {
    await markOrderFailed(result.payment.orderId);
    const order = await db.order.findUnique({ where: { id: result.payment.orderId }, include: { user: true } });
    if (order) {
      void checkRepeatedPaymentFailures(order.userId);
      void enqueueEmail(order.user.email, buildPaymentFailedEmail(order.id, `${siteUrl}/cart`));
    }
  }
  // "refunded" events arriving via webhook (rather than originating from
  // this app's own refund workflow) are recorded on the Payment row by
  // handleWebhook() already; src/features/refunds/refund-service.ts is
  // where a refund's side effects (ledger reversal, license/entitlement
  // revocation, invoice status) are applied for refunds this app initiates.

  return NextResponse.json({ received: true, matched: true });
}
