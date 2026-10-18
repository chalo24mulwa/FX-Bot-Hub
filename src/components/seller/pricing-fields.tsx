"use client";

import { useState } from "react";
import { PriceInput, type PriceValue } from "@/components/seller/price-input";
import { computeDiscountPercent, validatePricing } from "@/lib/pricing/discount";
import { centsToDollarString } from "@/lib/pricing/price-input";

export interface PricingState {
  offerCents: number | null;
  marketCents: number | null;
  /** Both fields hold valid amounts and, together, a valid (or absent) discount. */
  valid: boolean;
  /** Why not, in words — shown under the fields and by the wizard when Next is refused. */
  problem: string | null;
}

/**
 * Market price + offer price, with a live preview of the discount buyers will see. The browser check uses the same pure rules the
 * server enforces (src/lib/pricing/discount.ts); the server re-validates regardless. Names are only needed in the single-page form,
 * where the values are posted as `marketPrice` and `price` (dollars).
 */
export function PricingFields({
  offerName,
  marketName,
  defaultOfferCents = 0,
  defaultMarketCents = null,
  subscription = false,
  onChange,
}: {
  offerName?: string;
  marketName?: string;
  defaultOfferCents?: number;
  defaultMarketCents?: number | null;
  subscription?: boolean;
  onChange?: (state: PricingState) => void;
}) {
  const [offer, setOffer] = useState<PriceValue>({ cents: defaultOfferCents, valid: true });
  const [market, setMarket] = useState<PriceValue>({ cents: defaultMarketCents, valid: true });

  function report(nextOffer: PriceValue, nextMarket: PriceValue) {
    const fieldsValid = nextOffer.valid && nextMarket.valid && nextOffer.cents !== null;
    const problem = !fieldsValid
      ? "Enter valid amounts in dollars, like 49.00."
      : validatePricing({ pricingType: "ONE_TIME", priceCents: nextOffer.cents ?? 0, marketPriceCents: nextMarket.cents });
    onChange?.({ offerCents: nextOffer.cents, marketCents: nextMarket.cents, valid: problem === null, problem });
    return problem;
  }

  const fieldsValid = offer.valid && market.valid && offer.cents !== null;
  const problem =
    fieldsValid && market.cents !== null
      ? validatePricing({ pricingType: "ONE_TIME", priceCents: offer.cents ?? 0, marketPriceCents: market.cents })
      : null;
  const percent = fieldsValid && !problem ? computeDiscountPercent(market.cents, offer.cents ?? 0) : null;
  const per = subscription ? " / month" : "";

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-start gap-x-6 gap-y-3">
        <PriceInput
          name={marketName}
          label={`Market price (USD)${per}`}
          optional
          defaultCents={defaultMarketCents}
          placeholder="e.g. 100.00"
          hint="Optional. The original price, shown crossed out."
          onValueChange={(v) => {
            setMarket(v);
            report(offer, v);
          }}
        />
        <PriceInput
          name={offerName}
          label={`Offer price (USD)${per}`}
          defaultCents={defaultOfferCents}
          hint="What buyers actually pay."
          onValueChange={(v) => {
            setOffer(v);
            report(v, market);
          }}
        />
      </div>

      {problem && (
        <p role="alert" className="max-w-xl text-xs text-red-600">
          {problem}
        </p>
      )}
      {percent !== null && market.cents !== null && offer.cents !== null && (
        <p className="text-sm text-slate-700" data-testid="discount-preview">
          Buyers will see <strong className="text-red-600">{percent}% OFF</strong> —{" "}
          <strong>${centsToDollarString(offer.cents)}</strong>{" "}
          <span className="text-slate-400 line-through">${centsToDollarString(market.cents)}</span>
        </p>
      )}
    </div>
  );
}
