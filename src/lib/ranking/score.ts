import type { RankingWeights } from "@/features/admin/settings-service";

export interface RankingFactors {
  sales: number;
  downloads: number;
  reviews: number;
  rating: number;
  ageDays: number;
  favorites: number;
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
    weights.favorites * factors.favorites
  );
}
