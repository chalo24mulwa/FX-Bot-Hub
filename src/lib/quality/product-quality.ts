/**
 * Product quality signals — a checklist of concrete, verifiable things
 * ("has documentation," "seller is verified," "recently updated"), never a
 * claim about a product's trading performance, profitability, or safety.
 * Per the Phase 5 brief: do NOT let this be read as "this EA is good/safe
 * to trade" — it only means "this listing meets baseline
 * completeness/trust signals." Every UI surface showing this must keep
 * that framing (see the product page's own copy).
 */
export interface QualitySignals {
  hasDocumentation: boolean;
  hasScreenshots: boolean;
  hasCompatibilityInfo: boolean;
  recentlyUpdated: boolean;
  verifiedSeller: boolean;
  hasVerifiedReviews: boolean;
}

export interface QualityResult {
  score: number; // 0-1
  metCount: number;
  totalCount: number;
  signals: QualitySignals;
}

export function computeQualityScore(signals: QualitySignals): QualityResult {
  const entries = Object.values(signals);
  const metCount = entries.filter(Boolean).length;
  const totalCount = entries.length;
  return { score: totalCount === 0 ? 0 : metCount / totalCount, metCount, totalCount, signals };
}

const RECENCY_WINDOW_DAYS = 180;

export function isRecentlyUpdated(updatedAt: Date, now: Date = new Date(), windowDays = RECENCY_WINDOW_DAYS): boolean {
  const ageDays = (now.getTime() - updatedAt.getTime()) / 86_400_000;
  return ageDays <= windowDays;
}
