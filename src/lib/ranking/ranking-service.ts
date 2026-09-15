import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { getMarketplaceSettings, getRankingWeights } from "@/features/admin/settings-service";
import type { ListProductsQuery } from "@/lib/validations/product";
import { buildProductWhere, productListInclude } from "@/repositories/product-repository";
import { computeRankingScore } from "./score";
import { cacheWrap } from "@/lib/cache";
import { computeQualityScore, isRecentlyUpdated } from "@/lib/quality/product-quality";

// Ranking must not simply reflect price — it's a weighted blend of sales,
// downloads, reviews, rating, recency, and favorites (weights configurable
// by admin, see MarketplaceSettings). Computed over a bounded candidate set
// (not the whole catalog) in one query with relation counts, then sorted in
// memory — deliberately not per-row extra queries, and deliberately not an
// unbounded fetch. Revisit with a materialized/cron-computed score column
// if the catalog outgrows CANDIDATE_LIMIT.
const CANDIDATE_LIMIT = 500;

// Phase 5: the single most expensive read in the app (a 500-row candidate
// fetch plus in-memory scoring) was run uncached on every marketplace page
// load (docs/PHASE5_AUDIT.md). Cached below, keyed by the full filter/sort/
// page signature so different filter combinations never collide — only
// when `extra` isn't supplied, since that parameter has no caller today
// (grep confirms) and building a cache key that safely covers an arbitrary
// Prisma where-clause isn't worth doing for a branch nothing exercises.
// No explicit invalidation on product moderation/price changes — a ≤90s
// staleness window for "is this product visible/where does it rank" is an
// acceptable, deliberate tradeoff (see docs/PHASE5_AUDIT.md's caching
// section for why TTL-only was chosen over adding invalidation calls at
// every mutation site).
const RANKED_PRODUCTS_TTL_SECONDS = 90;

export async function listRankedProducts(
  query: ListProductsQuery,
  extra?: Prisma.ProductWhereInput
) {
  if (!extra) {
    return cacheWrap(`ranked-products:${JSON.stringify(query)}`, RANKED_PRODUCTS_TTL_SECONDS, () =>
      computeRankedProducts(query, extra)
    );
  }
  return computeRankedProducts(query, extra);
}

async function computeRankedProducts(query: ListProductsQuery, extra?: Prisma.ProductWhereInput) {
  const where = await buildProductWhere(query, { status: "PUBLISHED", ...extra });

  const candidates = await db.product.findMany({
    where,
    take: CANDIDATE_LIMIT,
    include: {
      ...productListInclude,
      _count: {
        select: { orderItems: true, downloads: true, reviews: true, favorites: true, documentation: true, screenshots: true },
      },
    },
  });

  const settings = await getMarketplaceSettings();
  const weights = getRankingWeights(settings);
  const now = Date.now();

  const scored = candidates.map((product) => {
    const ageDays = (now - product.createdAt.getTime()) / 86_400_000;
    const quality = computeQualityScore({
      hasDocumentation: product._count.documentation > 0,
      hasScreenshots: product._count.screenshots > 0,
      hasCompatibilityInfo: Boolean(product.compatibilityNotes?.trim()),
      recentlyUpdated: isRecentlyUpdated(product.updatedAt),
      verifiedSeller: product.seller.sellerProfile?.verified ?? false,
      // Approximation for ranking's cheap per-candidate signal: "has any
      // reviews at all," not specifically verified-purchase ones — a
      // filtered relation count for just verifiedPurchase reviews would
      // require dropping the plain total-review count this candidate query
      // also needs (Prisma's _count can't return both a plain and a
      // filtered count for the same relation). The product detail page
      // (productDetailInclude, which loads full review rows) computes the
      // precise verified-only version instead — see its page component.
      hasVerifiedReviews: product._count.reviews > 0,
    });
    const score = computeRankingScore(weights, {
      sales: product._count.orderItems,
      downloads: product._count.downloads,
      reviews: product._count.reviews,
      rating: product.rating?.average ?? 0,
      ageDays,
      favorites: product._count.favorites,
      quality: quality.score,
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
