import { db } from "@/lib/db";
import type { Payment, PaymentStatus } from "@prisma/client";
import { paymentProvider } from "./index";
import type { WebhookEvent } from "./types";

export class PaymentServiceError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

export interface CreatePaymentInput {
  orderId: string;
  amountCents: number;
  currency: string;
  description: string;
  customerEmail: string;
}

/**
 * Records a Payment row and charges it through the configured provider in
 * one step. This is the only place that should call
 * `paymentProvider.createCharge()` directly — checkout and subscription
 * renewal both go through here so every charge, regardless of caller,
 * lands in the `payments` table the same way.
 */
export async function createPayment(input: CreatePaymentInput): Promise<Payment> {
  const charge = await paymentProvider.createCharge(input);

  return db.payment.create({
    data: {
      orderId: input.orderId,
      provider: paymentProvider.name,
      status: charge.status === "succeeded" ? "SUCCEEDED" : charge.status === "failed" ? "FAILED" : "INITIATED",
      amountCents: input.amountCents,
      currency: input.currency,
      providerReference: charge.providerReference,
      rawPayload: { redirectUrl: charge.redirectUrl },
    },
  });
}

/** The trusted, DB-recorded status for a payment — never trust a
 * frontend's "success" redirect on its own; this (or a verified webhook)
 * is the actual source of truth. See PRODUCTION REQUIREMENT in CLAUDE.md. */
export async function getPaymentStatus(paymentId: string): Promise<PaymentStatus> {
  const payment = await db.payment.findUnique({ where: { id: paymentId }, select: { status: true } });
  if (!payment) throw new PaymentServiceError("Payment not found.", 404);
  return payment.status;
}

/**
 * Re-derives a payment's status from its trusted record. For the manual
 * provider (synchronous, no remote state) this is just a DB read; a real
 * async provider (Stripe/M-Pesa, once implemented) would call out to the
 * processor here to reconcile a payment that's been INITIATED too long
 * without a webhook arriving, rather than trusting the DB row blindly.
 */
export async function verifyPayment(paymentId: string): Promise<Payment> {
  const payment = await db.payment.findUnique({ where: { id: paymentId } });
  if (!payment) throw new PaymentServiceError("Payment not found.", 404);
  return payment;
}

export interface WebhookProcessResult {
  duplicate: boolean;
  event: WebhookEvent | null;
  payment: Payment | null;
}

/**
 * The only entry point for inbound payment-provider callbacks
 * (src/app/api/payments/webhook/route.ts). Order:
 *  1. provider.parseWebhook() — verifies the payload's signature and
 *     normalizes it (throws on an invalid signature; never trust an
 *     unverified body).
 *  2. Dedup by the provider's own event id (ProcessedWebhookEvent) — a
 *     retried delivery is a no-op, not a second `completePaidOrder()`.
 *  3. Look up the Payment by (provider, providerReference) and update it;
 *     the caller (the route) is responsible for acting on a "succeeded"
 *     result (calling completePaidOrder) since that also touches
 *     licenses/subscriptions/notifications outside this module's scope.
 */
export async function handleWebhook(rawBody: string, headers: Record<string, string>): Promise<WebhookProcessResult> {
  const event = await paymentProvider.parseWebhook(rawBody, headers);

  const existing = await db.processedWebhookEvent.findUnique({
    where: { provider_eventId: { provider: paymentProvider.name, eventId: event.eventId } },
  });
  if (existing) {
    return { duplicate: true, event, payment: null };
  }
  await db.processedWebhookEvent.create({ data: { provider: paymentProvider.name, eventId: event.eventId } });

  const payment = await db.payment.findUnique({
    where: { provider_providerReference: { provider: paymentProvider.name, providerReference: event.providerReference } },
  });
  if (!payment) {
    return { duplicate: false, event, payment: null };
  }

  const nextStatus: PaymentStatus =
    event.status === "succeeded" ? "SUCCEEDED" : event.status === "failed" ? "FAILED" : "REFUNDED";

  const updated = await db.payment.update({
    where: { id: payment.id },
    data: { status: nextStatus, rawPayload: event.rawPayload as object },
  });

  return { duplicate: false, event, payment: updated };
}

export interface RefundPaymentInput {
  paymentId: string;
  amountCents: number;
  reason?: string;
}

export interface RefundPaymentResult {
  providerRefundReference: string;
}

/**
 * The provider-facing half of a refund — calls the processor and returns
 * its reference. Does NOT touch Order/License/Subscription/LedgerEntry
 * state or send email; that workflow (with REQUESTED/APPROVED/REJECTED/
 * PROCESSED states) lives in src/features/refunds/refund-service.ts, which
 * calls this as one step. Kept separate so "charge a refund through the
 * provider" and "what a refund means for this app's own records" don't mix.
 */
export async function refundPayment(input: RefundPaymentInput): Promise<RefundPaymentResult> {
  const payment = await db.payment.findUnique({ where: { id: input.paymentId } });
  if (!payment) throw new PaymentServiceError("Payment not found.", 404);
  if (payment.status !== "SUCCEEDED") {
    throw new PaymentServiceError("Only a succeeded payment can be refunded.", 409);
  }
  if (!payment.providerReference) {
    throw new PaymentServiceError("Payment has no provider reference to refund.", 409);
  }

  const result = await paymentProvider.refundCharge({
    providerReference: payment.providerReference,
    amountCents: input.amountCents,
    currency: payment.currency,
    reason: input.reason,
  });
  if (result.status !== "succeeded") {
    throw new PaymentServiceError("Refund was not accepted by the payment provider.", 502);
  }

  return { providerRefundReference: result.providerRefundReference };
}
