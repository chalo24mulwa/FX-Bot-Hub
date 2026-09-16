export interface ChargeInput {
  orderId: string;
  amountCents: number;
  currency: string;
  /** Buyer-facing description, e.g. "fx Bot Hub order #123". */
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
  /** The provider's own event id, for dedup — see ProcessedWebhookEvent. Falls back to providerReference for providers without a separate event id (e.g. the manual provider). */
  eventId: string;
  providerReference: string;
  status: "succeeded" | "failed" | "refunded";
  rawPayload: unknown;
}

export interface RefundInput {
  providerReference: string;
  amountCents: number;
  currency: string;
  reason?: string;
}

export interface RefundResult {
  providerRefundReference: string;
  status: "succeeded" | "failed";
}

export interface PaymentProvider {
  readonly name: "STRIPE" | "MPESA" | "MANUAL";
  createCharge(input: ChargeInput): Promise<ChargeResult>;
  /**
   * Verify and normalize an inbound webhook/callback payload. A real
   * implementation (Stripe/M-Pesa) MUST validate the payload's signature
   * here — using the request's raw body and headers, not the parsed JSON —
   * and throw rather than return a WebhookEvent for a payload that fails
   * verification. The manual provider has no signature to check.
   */
  parseWebhook(rawBody: string, headers: Record<string, string>): Promise<WebhookEvent>;
  /** Refund a previously succeeded charge, in whole or in part. */
  refundCharge(input: RefundInput): Promise<RefundResult>;
}
