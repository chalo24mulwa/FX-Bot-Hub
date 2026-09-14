import { db } from "@/lib/db";

/**
 * Every number here comes from a single grouped/aggregate query scoped to
 * the seller's own product ids — never a per-product loop of queries, and
 * never an unbounded row scan (revenue/sales use Prisma's aggregate, counts
 * use count/groupBy). Keep it that way as this grows.
 */
export async function getSellerDashboardStats(sellerId: string) {
  const [statusCounts, salesAgg, downloadCount, ratingAgg, favoriteCount, viewsAgg] = await Promise.all([
    db.product.groupBy({ by: ["status"], where: { sellerId }, _count: true }),
    db.orderItem.aggregate({
      where: { product: { sellerId }, order: { status: "PAID" } },
      _sum: { unitPriceCents: true, quantity: true },
      _count: true,
    }),
    db.download.count({ where: { product: { sellerId } } }),
    db.review.aggregate({ where: { product: { sellerId }, hidden: false }, _avg: { rating: true }, _count: true }),
    db.favorite.count({ where: { product: { sellerId } } }),
    db.product.aggregate({ where: { sellerId }, _sum: { viewCount: true } }),
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
    views: viewsAgg._sum.viewCount ?? 0,
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
 * list (the seller's own catalog), not one query per product. */
export async function getSellerProductAnalytics(sellerId: string): Promise<ProductAnalyticsRow[]> {
  const products = await db.product.findMany({
    where: { sellerId },
    select: { id: true, name: true, viewCount: true, rating: true },
  });
  const productIds = products.map((p) => p.id);
  if (productIds.length === 0) return [];

  const [favorites, sales, downloads] = await Promise.all([
    db.favorite.groupBy({ by: ["productId"], where: { productId: { in: productIds } }, _count: true }),
    db.orderItem.groupBy({
      by: ["productId"],
      where: { productId: { in: productIds }, order: { status: "PAID" } },
      _sum: { quantity: true, unitPriceCents: true },
    }),
    db.download.groupBy({ by: ["productId"], where: { productId: { in: productIds } }, _count: true }),
  ]);

  const favoriteMap = new Map(favorites.map((f) => [f.productId, f._count]));
  const salesMap = new Map(sales.map((s) => [s.productId, s]));
  const downloadMap = new Map(downloads.map((d) => [d.productId, d._count]));

  return products.map((p) => {
    const sale = salesMap.get(p.id);
    const salesCount = sale?._sum.quantity ?? 0;
    const views = p.viewCount;
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

export async function listSellerCustomers(sellerId: string, page: number, pageSize: number) {
  const buyers = await db.orderItem.findMany({
    where: { product: { sellerId }, order: { status: "PAID" } },
    select: { order: { select: { userId: true, user: { select: { name: true, email: true } }, createdAt: true } } },
    distinct: ["orderId"],
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

export async function listSellerReviews(sellerId: string) {
  return db.review.findMany({
    where: { product: { sellerId } },
    orderBy: { createdAt: "desc" },
    include: { user: { select: { name: true } }, product: { select: { name: true, slug: true } } },
  });
}
