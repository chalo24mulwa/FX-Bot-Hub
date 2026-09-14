import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { getMarketplaceSettings, getRankingWeights } from "@/features/admin/settings-service";
import type { ListProductsQuery } from "@/lib/validations/product";
import { buildProductWhere, productListInclude } from "@/repositories/product-repository";
import { computeRankingScore } from "./score";

// Ranking must not simply reflect price — it's a weighted blend of sales,
// downloads, reviews, rating, recency, and favorites (weights configurable
// by admin, see MarketplaceSettings). Computed over a bounded candidate set
// (not the whole catalog) in one query with relation counts, then sorted in
// memory — deliberately not per-row extra queries, and deliberately not an
// unbounded fetch. Revisit with a materialized/cron-computed score column
// if the catalog outgrows CANDIDATE_LIMIT.
const CANDIDATE_LIMIT = 500;

export async function listRankedProducts(
  query: ListProductsQuery,
  extra?: Prisma.ProductWhereInput
) {
  const where = await buildProductWhere(query, { status: "PUBLISHED", ...extra });

  const candidates = await db.product.findMany({
    where,
    take: CANDIDATE_LIMIT,
    include: {
      ...productListInclude,
      _count: { select: { orderItems: true, downloads: true, reviews: true, favorites: true } },
    },
  });

  const settings = await getMarketplaceSettings();
  const weights = getRankingWeights(settings);
  const now = Date.now();

  const scored = candidates.map((product) => {
    const ageDays = (now - product.createdAt.getTime()) / 86_400_000;
    const score = computeRankingScore(weights, {
      sales: product._count.orderItems,
      downloads: product._count.downloads,
      reviews: product._count.reviews,
      rating: product.rating?.average ?? 0,
      ageDays,
      favorites: product._count.favorites,
    });
    return { product, score, salesCount: product._count.orderItems };
  });

  scored.sort((a, b) =>
    query.sort === "best_sellers" ? b.salesCount - a.salesCount : b.score - a.score
  );

  const total = scored.length;
  const start = (query.page - 1) * query.pageSize;
  const items = scored.slice(start, start + query.pageSize).map((s) => s.product);

  return { items, total, page: query.page, pageSize: query.pageSize };
}
