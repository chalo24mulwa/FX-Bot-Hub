import { MAX_PRICE_CENTS, centsToDollarString } from "./price-input";

// Discounts are never stored: a product has an offer price (`priceCents`, what buyers pay and what checkout charges) and an
// optional market price (`marketPriceCents`, the original price shown crossed out). The percentage is always derived from the
// two, here, so the badge, the card, the detail page, the form preview and the server can't disagree.

export interface PricingFields {
  pricingType: string;
  priceCents: number;
  marketPriceCents?: number | null;
}

/**
 * Whole-number discount: ((market - offer) / market) * 100, rounded to the nearest whole percent.
 * Returns null unless there is a real discount to show: both prices positive, offer strictly below market, and the rounded
 * result at least 1%. Capped at 99 — a sub-cent offer must never read "100% OFF".
 */
export function computeDiscountPercent(marketPriceCents: number | null | undefined, offerPriceCents: number): number | null {
  if (typeof marketPriceCents !== "number" || !Number.isFinite(marketPriceCents) || !Number.isFinite(offerPriceCents)) return null;
  if (marketPriceCents <= 0 || offerPriceCents <= 0 || offerPriceCents >= marketPriceCents) return null;
  const percent = Math.round(((marketPriceCents - offerPriceCents) / marketPriceCents) * 100);
  return percent >= 1 ? Math.min(percent, 99) : null;
}

/** What to render for a product's price: the offer, and the crossed-out market price + percent only when a valid discount exists. */
export function priceDisplay(product: PricingFields): { offerCents: number; marketCents: number | null; percent: number | null; free: boolean } {
  const free = product.pricingType === "FREE" || product.priceCents === 0;
  const percent = free ? null : computeDiscountPercent(product.marketPriceCents, product.priceCents);
  return { offerCents: product.priceCents, marketCents: percent === null ? null : (product.marketPriceCents ?? null), percent, free };
}

/**
 * The one server-side rule set for market/offer pricing. Returns an error message, or null when the combination is valid.
 * (A free product's market price is simply cleared by `normalizePricing`, not an error.)
 */
export function validatePricing(fields: PricingFields): string | null {
  const { pricingType, priceCents, marketPriceCents } = fields;
  if (!Number.isInteger(priceCents) || priceCents < 0 || priceCents > MAX_PRICE_CENTS) return "Enter a valid offer price.";
  if (pricingType === "FREE") return priceCents === 0 ? null : "A free product must have an offer price of $0.00.";
  if (marketPriceCents === null || marketPriceCents === undefined) return null;
  if (!Number.isInteger(marketPriceCents) || marketPriceCents <= 0 || marketPriceCents > MAX_PRICE_CENTS) {
    return "Enter a valid market price, like 100.00, or leave it blank for no discount.";
  }
  if (priceCents <= 0) return "Set an offer price above $0.00 to show a discount, or clear the market price.";
  if (marketPriceCents <= priceCents) {
    return `The offer price (${"$"}${centsToDollarString(priceCents)}) must be lower than the market price (${"$"}${centsToDollarString(marketPriceCents)}) to show a discount.`;
  }
  if (computeDiscountPercent(marketPriceCents, priceCents) === null) {
    return "That difference is under 1%, which is too small to show as a discount. Lower the offer price or clear the market price.";
  }
  return null;
}

/** Free products never carry a market price; everything else keeps what was given. */
export function normalizePricing<T extends PricingFields>(fields: T): T {
  return fields.pricingType === "FREE" ? { ...fields, marketPriceCents: null } : fields;
}
