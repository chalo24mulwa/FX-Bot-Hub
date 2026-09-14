import { db } from "@/lib/db";
import { recordAuditLog } from "@/repositories/audit-log-repository";

export interface RankingWeights {
  sales: number;
  downloads: number;
  reviews: number;
  rating: number;
  recency: number;
  favorites: number;
}

const DEFAULT_WEIGHTS: RankingWeights = {
  sales: 3,
  downloads: 1,
  reviews: 1,
  rating: 2,
  recency: 1,
  favorites: 1,
};

/** Upserts the singleton row on first read so every caller gets a settings
 * object without null-checking — see prisma/schema.prisma's MarketplaceSettings. */
export async function getMarketplaceSettings() {
  return db.marketplaceSettings.upsert({
    where: { id: "singleton" },
    update: {},
    create: { id: "singleton" },
  });
}

export function getRankingWeights(settings: { rankingWeights: unknown }): RankingWeights {
  const w = settings.rankingWeights as Partial<RankingWeights> | null;
  return { ...DEFAULT_WEIGHTS, ...w };
}

export async function updateMarketplaceSettings(
  actorId: string,
  input: { commissionPercent?: number; rankingWeights?: Partial<RankingWeights> }
) {
  const current = await getMarketplaceSettings();
  const nextWeights = input.rankingWeights
    ? { ...getRankingWeights(current), ...input.rankingWeights }
    : current.rankingWeights;

  const updated = await db.marketplaceSettings.update({
    where: { id: "singleton" },
    data: {
      commissionPercent: input.commissionPercent ?? current.commissionPercent,
      rankingWeights: nextWeights as object,
    },
  });

  await recordAuditLog({
    actorId,
    action: "marketplace_settings.update",
    entityType: "MarketplaceSettings",
    entityId: "singleton",
    metadata: input,
  });

  return updated;
}
