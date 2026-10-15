// How a VPS provider is presented: price text, offer visibility, and the call-to-action link. Pure, so the
// rules (never show an expired offer, never invent a price, mark affiliate links) are tested.

export interface PriceParts {
  priceCents: number | null;
  priceCurrency: string | null;
  pricePeriod: string | null;
}

/** "From $9.99 / month", or null when any part of the price is missing (never a partial or guessed price). */
export function formatStartingPrice(p: PriceParts): string | null {
  if (p.priceCents === null || !p.priceCurrency || (p.pricePeriod !== "MONTH" && p.pricePeriod !== "YEAR")) return null;
  const amount = p.priceCents / 100;
  let text: string;
  try {
    text = new Intl.NumberFormat("en-US", { style: "currency", currency: p.priceCurrency }).format(amount);
  } catch {
    text = `${amount.toFixed(2)} ${p.priceCurrency}`;
  }
  return `From ${text} / ${p.pricePeriod === "MONTH" ? "month" : "year"}`;
}

/** An offer is shown while it has no expiry or its expiry day (inclusive, UTC) hasn't passed. */
export function isOfferActive(expiresAt: Date | string | null, now: Date = new Date()): boolean {
  if (!expiresAt) return true;
  const day = (typeof expiresAt === "string" ? new Date(expiresAt) : expiresAt).toISOString().slice(0, 10);
  return day >= now.toISOString().slice(0, 10);
}

export interface VpsLinks {
  officialUrl: string;
  affiliateUrl: string | null;
  ctaLabel: string | null;
}

export interface VpsCta {
  href: string;
  label: string;
  rel: string;
  isAffiliate: boolean;
}

const SAFE_REL = "noopener noreferrer";

export function vpsCta(p: VpsLinks): VpsCta {
  if (p.affiliateUrl) {
    return { href: p.affiliateUrl, label: p.ctaLabel ?? "Get VPS", rel: `sponsored nofollow ${SAFE_REL}`, isAffiliate: true };
  }
  return { href: p.officialUrl, label: p.ctaLabel ?? "Visit Provider", rel: SAFE_REL, isAffiliate: false };
}

/** Secondary link to the provider's own site — shown only when the main button is an affiliate link. */
export function officialVpsLink(p: VpsLinks): { href: string; rel: string } | null {
  return p.affiliateUrl ? { href: p.officialUrl, rel: SAFE_REL } : null;
}
