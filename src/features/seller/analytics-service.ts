import { db } from "@/lib/db";

export interface SellerDateRange {
  from?: Date;
  to?: Date;
}

function rangeWhere(range: SellerDateRange) {
  return range.from || range.to ? { gte: range.from, lte: range.to } : undefined;
}

/**
 * Every number here comes from a single grouped/aggregate query scoped to
 * the seller's own product ids — never a per-product loop of queries, and
 * never an unbounded row scan (revenue/sales use Prisma's aggregate, counts
 * use count/groupBy). Keep it that way as this grows.
 *
 * Phase 5 added `range` (docs/PHASE5_AUDIT.md's seller-analytics
 * date-filtering requirement): sales/downloads/favorites/reviews filter by
 * their own createdAt within range. `views` is the one exception — outside
 * a range filter it uses the all-time `Product.viewCount` counter (no
 * per-event history exists before Phase 5's AnalyticsEvent tracking); once
 * a range is given, it switches to counting tracked PRODUCT_VIEW events
 * instead, which is accurate only from when that tracking went live.
 */
export async function getSellerDashboardStats(sellerId: string, range: SellerDateRange = {}) {
  const dateFilter = rangeWhere(range);
  const isRanged = Boolean(dateFilter);

  const [statusCounts, salesAgg, downloadCount, ratingAgg, favoriteCount, viewsAgg, trackedViews] = await Promise.all([
    db.product.groupBy({ by: ["status"], where: { sellerId }, _count: true }),
    db.orderItem.aggregate({
      where: { product: { sellerId }, order: { status: "PAID", createdAt: dateFilter } },
      _sum: { unitPriceCents: true, quantity: true },
      _count: true,
    }),
    db.download.count({ where: { product: { sellerId }, createdAt: dateFilter } }),
    db.review.aggregate({
      where: { product: { sellerId }, hidden: false, createdAt: dateFilter },
      _avg: { rating: true },
      _count: true,
    }),
    db.favorite.count({ where: { product: { sellerId }, createdAt: dateFilter } }),
    isRanged ? Promise.resolve(null) : db.product.aggregate({ where: { sellerId }, _sum: { viewCount: true } }),
    isRanged
      ? db.analyticsEvent.count({ where: { type: "PRODUCT_VIEW", product: { sellerId }, createdAt: dateFilter } })
      : Promise.resolve(null),
  ]);

  const byStatus = Object.fromEntries(statusCounts.map((s) => [s.status, s._count]));

  return {
    totalProducts: statusCounts.reduce((sum, s) => sum + s._count, 0),
    published: byStatus.PUBLISHED ?? 0,
    pending: (byStatus.PENDING_REVIEW ?? 0) + (byStatus.UNDER_REVIEW ?? 0),
    rejected: byStatus.REJECTED ?? 0,
    sales: salesAgg._sum.quantity ?? 0,
    revenueCents: salesAgg._sum.unitPriceCents ?? 0,
    downloads: downloadCount,
    averageRating: ratingAgg._avg.rating ?? 0,
    ratingCount: ratingAgg._count,
    favorites: favoriteCount,
    views: isRanged ? (trackedViews ?? 0) : (viewsAgg?._sum.viewCount ?? 0),
  };
}

export interface ProductAnalyticsRow {
  productId: string;
  name: string;
  views: number;
  favorites: number;
  sales: number;
  revenueCents: number;
  downloads: number;
  rating: number;
  reviewCount: number;
  conversionRate: number;
}

/** Per-product breakdown for the "Product Analytics" section — one query
 * per metric (grouped/counted), joined in memory over a bounded product
 * list (the seller's own catalog), not one query per product. Same
 * `views` caveat as getSellerDashboardStats above when `range` is given. */
export async function getSellerProductAnalytics(
  sellerId: string,
  range: SellerDateRange = {}
): Promise<ProductAnalyticsRow[]> {
  const dateFilter = rangeWhere(range);
  const isRanged = Boolean(dateFilter);

  const products = await db.product.findMany({
    where: { sellerId },
    select: { id: true, name: true, viewCount: true, rating: true },
  });
  const productIds = products.map((p) => p.id);
  if (productIds.length === 0) return [];

  const [favorites, sales, downloads, trackedViews] = await Promise.all([
    db.favorite.groupBy({ by: ["productId"], where: { productId: { in: productIds }, createdAt: dateFilter }, _count: true }),
    db.orderItem.groupBy({
      by: ["productId"],
      where: { productId: { in: productIds }, order: { status: "PAID", createdAt: dateFilter } },
      _sum: { quantity: true, unitPriceCents: true },
    }),
    db.download.groupBy({ by: ["productId"], where: { productId: { in: productIds }, createdAt: dateFilter }, _count: true }),
    isRanged
      ? db.analyticsEvent.groupBy({
          by: ["productId"],
          where: { type: "PRODUCT_VIEW", productId: { in: productIds }, createdAt: dateFilter },
          _count: true,
        })
      : Promise.resolve(null),
  ]);

  const favoriteMap = new Map(favorites.map((f) => [f.productId, f._count]));
  const salesMap = new Map(sales.map((s) => [s.productId, s]));
  const downloadMap = new Map(downloads.map((d) => [d.productId, d._count]));
  const trackedViewMap = new Map((trackedViews ?? []).map((v) => [v.productId, v._count]));

  return products.map((p) => {
    const sale = salesMap.get(p.id);
    const salesCount = sale?._sum.quantity ?? 0;
    const views = isRanged ? (trackedViewMap.get(p.id) ?? 0) : p.viewCount;
    return {
      productId: p.id,
      name: p.name,
      views,
      favorites: favoriteMap.get(p.id) ?? 0,
      sales: salesCount,
      revenueCents: sale?._sum.unitPriceCents ?? 0,
      downloads: downloadMap.get(p.id) ?? 0,
      rating: p.rating?.average ?? 0,
      reviewCount: p.rating?.count ?? 0,
      conversionRate: views === 0 ? 0 : salesCount / views,
    };
  });
}

export async function listSellerOrders(sellerId: string, page: number, pageSize: number) {
  const where = { product: { sellerId } };
  const [items, total] = await Promise.all([
    db.orderItem.findMany({
      where,
      orderBy: { order: { createdAt: "desc" } },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: { order: { include: { user: { select: { name: true, email: true } } } }, product: { select: { name: true } } },
    }),
    db.orderItem.count({ where }),
  ]);
  return { items, total, page, pageSize };
}

// Phase 5: `distinct` over a join doesn't support offset/cursor pagination
// cleanly in Prisma, so this still fetches then aggregates in memory — but
// previously had no bound at all (docs/PHASE5_AUDIT.md). This cap keeps
// memory use bounded; a seller with more than this many distinct paid
// orders needs a materialized "seller customers" view instead of this
// query shape, noted as a follow-up rather than solved speculatively here.
const MAX_CUSTOMER_ORDER_ITEMS = 10_000;

export async function listSellerCustomers(sellerId: string, page: number, pageSize: number) {
  const buyers = await db.orderItem.findMany({
    where: { product: { sellerId }, order: { status: "PAID" } },
    select: { order: { select: { userId: true, user: { select: { name: true, email: true } }, createdAt: true } } },
    distinct: ["orderId"],
    orderBy: { order: { createdAt: "desc" } },
    take: MAX_CUSTOMER_ORDER_ITEMS,
  });

  const byUser = new Map<string, { name: string | null; email: string; orders: number; lastPurchase: Date }>();
  for (const item of buyers) {
    const u = item.order.user;
    const existing = byUser.get(item.order.userId);
    if (existing) {
      existing.orders += 1;
      if (item.order.createdAt > existing.lastPurchase) existing.lastPurchase = item.order.createdAt;
    } else {
      byUser.set(item.order.userId, { name: u.name, email: u.email, orders: 1, lastPurchase: item.order.createdAt });
    }
  }

  const all = [...byUser.values()].sort((a, b) => b.lastPurchase.getTime() - a.lastPurchase.getTime());
  const total = all.length;
  const items = all.slice((page - 1) * pageSize, (page - 1) * pageSize + pageSize);
  return { items, total, page, pageSize };
}

// Phase 5: previously unbounded (docs/PHASE5_AUDIT.md) — a seller with a
// large catalog and review volume would pull their entire review history
// into memory on every page view. The reviews page itself has no
// pagination UI yet, so this is a safety cap, not real pagination; true
// pagination is a follow-up alongside the page's UI.
const MAX_SELLER_REVIEWS = 2_000;

export async function listSellerReviews(sellerId: string) {
  return db.review.findMany({
    where: { product: { sellerId } },
    orderBy: { createdAt: "desc" },
    include: { user: { select: { name: true } }, product: { select: { name: true, slug: true } } },
    take: MAX_SELLER_REVIEWS,
  });
}
