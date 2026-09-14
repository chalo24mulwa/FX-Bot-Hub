import type { ChargeInput, ChargeResult, PaymentProvider, WebhookEvent } from "./types";

// Stub for Phase 2: wire up the `stripe` SDK (create a PaymentIntent /
// Checkout Session in createCharge, verify signatures with
// stripe.webhooks.constructEvent in parseWebhook). Kept here now so the
// PaymentProvider seam and PaymentProviderName enum don't need to change
// later — only this file's internals do.
export class StripePaymentProvider implements PaymentProvider {
  readonly name = "STRIPE" as const;

  async createCharge(_input: ChargeInput): Promise<ChargeResult> {
    throw new Error("Stripe payment provider is not implemented yet.");
  }

  async parseWebhook(_rawBody: string, _headers: Record<string, string>): Promise<WebhookEvent> {
    throw new Error("Stripe payment provider is not implemented yet.");
  }
}
