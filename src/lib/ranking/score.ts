import type { RankingWeights } from "@/features/admin/settings-service";

export interface RankingFactors {
  sales: number;
  downloads: number;
  reviews: number;
  rating: number;
  ageDays: number;
  favorites: number;
  /** 0-1, from src/lib/quality/product-quality.ts's computeQualityScore().
   * Optional (defaults to 0) so existing call sites/tests that predate
   * Phase 5's quality factor don't all need updating at once. */
  quality?: number;
}

/** Pure scoring function, split out from ranking-service.ts so the weighting
 * math is unit-testable without a database. Recency decays smoothly rather
 * than cutting off sharply at a fixed age. */
export function computeRankingScore(weights: RankingWeights, factors: RankingFactors): number {
  const recencyScore = 1 / (1 + factors.ageDays / 30);
  return (
    weights.sales * factors.sales +
    weights.downloads * factors.downloads +
    weights.reviews * factors.reviews +
    weights.rating * factors.rating +
    weights.recency * recencyScore +
    weights.favorites * factors.favorites +
    (weights.quality ?? 0) * (factors.quality ?? 0)
  );
}
