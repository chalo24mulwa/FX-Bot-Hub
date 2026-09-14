import type { ChargeInput, ChargeResult, PaymentProvider, WebhookEvent } from "./types";

// Stub for Phase 2: implement Safaricom Daraja STK Push in createCharge
// (OAuth via MPESA_CONSUMER_KEY/SECRET, then /stkpush with MPESA_SHORTCODE
// + MPESA_PASSKEY) and validate the callback shape in parseWebhook.
export class MpesaPaymentProvider implements PaymentProvider {
  readonly name = "MPESA" as const;

  async createCharge(_input: ChargeInput): Promise<ChargeResult> {
    throw new Error("M-Pesa payment provider is not implemented yet.");
  }

  async parseWebhook(_rawBody: string, _headers: Record<string, string>): Promise<WebhookEvent> {
    throw new Error("M-Pesa payment provider is not implemented yet.");
  }
}
