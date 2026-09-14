export interface ChargeInput {
  orderId: string;
  amountCents: number;
  currency: string;
  /** Buyer-facing description, e.g. "FX Bot Market order #123". */
  description: string;
  customerEmail: string;
}

export interface ChargeResult {
  providerReference: string;
  /** URL to redirect the buyer to (hosted checkout) or an STK push prompt; null when the charge is already final. */
  redirectUrl: string | null;
  status: "initiated" | "succeeded" | "failed";
}

export interface WebhookEvent {
  providerReference: string;
  status: "succeeded" | "failed" | "refunded";
  rawPayload: unknown;
}

export interface PaymentProvider {
  readonly name: "STRIPE" | "MPESA" | "MANUAL";
  createCharge(input: ChargeInput): Promise<ChargeResult>;
  /** Verify and normalize an inbound webhook/callback payload. */
  parseWebhook(rawBody: string, headers: Record<string, string>): Promise<WebhookEvent>;
}
