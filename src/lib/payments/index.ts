import { env } from "@/lib/env";
import type { PaymentProvider } from "./types";
import { ManualPaymentProvider } from "./manual-provider";
import { StripePaymentProvider } from "./stripe-provider";
import { MpesaPaymentProvider } from "./mpesa-provider";

export type { PaymentProvider, ChargeInput, ChargeResult, WebhookEvent } from "./types";

function createPaymentProvider(): PaymentProvider {
  switch (env.PAYMENT_PROVIDER) {
    case "stripe":
      return new StripePaymentProvider();
    case "mpesa":
      return new MpesaPaymentProvider();
    case "manual":
    default:
      return new ManualPaymentProvider();
  }
}

// Checkout code depends on this interface only, so adding a processor is
// additive: a new class + a case here, never a change to callers.
export const paymentProvider: PaymentProvider = createPaymentProvider();
