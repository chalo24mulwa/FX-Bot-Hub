import { randomUUID } from "crypto";
import type { ChargeInput, ChargeResult, PaymentProvider, WebhookEvent } from "./types";

// Dev/staging default: marks orders paid immediately with no external call.
// Never enable in production — it exists so checkout is testable before a
// real processor (Stripe, M-Pesa) is wired up in a later phase.
export class ManualPaymentProvider implements PaymentProvider {
  readonly name = "MANUAL" as const;

  async createCharge(_input: ChargeInput): Promise<ChargeResult> {
    return {
      providerReference: `manual_${randomUUID()}`,
      redirectUrl: null,
      status: "succeeded",
    };
  }

  async parseWebhook(rawBody: string): Promise<WebhookEvent> {
    const payload = JSON.parse(rawBody);
    return {
      providerReference: payload.providerReference,
      status: "succeeded",
      rawPayload: payload,
    };
  }
}
