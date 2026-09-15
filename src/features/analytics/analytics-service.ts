import { db } from "@/lib/db";

export interface DateRange {
  from?: Date;
  to?: Date;
}

function rangeWhere(range: DateRange) {
  return range.from || range.to ? { gte: range.from, lte: range.to } : undefined;
}

/** Counts by event type over an optional date range — the admin
 * analytics dashboard's headline numbers. One groupBy, not a per-type loop. */
export async function getEventCounts(range: DateRange = {}) {
  const rows = await db.analyticsEvent.groupBy({
    by: ["type"],
    where: { createdAt: rangeWhere(range) },
    _count: true,
  });
  return Object.fromEntries(rows.map((r) => [r.type, r._count]));
}

const MAX_SEARCH_EVENTS_SAMPLED = 5_000;

/** Top search queries by frequency. Prisma can't group by a JSON field
 * directly, so this samples up to MAX_SEARCH_EVENTS_SAMPLED recent SEARCH
 * events and aggregates in memory — fine at this feature's real scale
 * (a marketplace's search volume, not a general web-scale search engine);
 * a true top-N-by-frequency query would need a raw SQL JSON aggregate if
 * search volume ever outgrows this. */
export async function getTopSearchQueries(range: DateRange = {}, limit = 10) {
  const events = await db.analyticsEvent.findMany({
    where: { type: "SEARCH", createdAt: rangeWhere(range) },
    select: { metadata: true },
    orderBy: { createdAt: "desc" },
    take: MAX_SEARCH_EVENTS_SAMPLED,
  });

  const counts = new Map<string, number>();
  for (const event of events) {
    const query = (event.metadata as { query?: string } | null)?.query?.trim().toLowerCase();
    if (!query) continue;
    counts.set(query, (counts.get(query) ?? 0) + 1);
  }

  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([query, count]) => ({ query, count }));
}

/** Most-viewed products (by tracked PRODUCT_VIEW events, not the
 * always-incrementing Product.viewCount counter) in a date range, joined
 * with their favorite/sales counts so conversion is visible per product. */
export async function getTopViewedProducts(range: DateRange = {}, limit = 10) {
  const grouped = await db.analyticsEvent.groupBy({
    by: ["productId"],
    where: { type: "PRODUCT_VIEW", productId: { not: null }, createdAt: rangeWhere(range) },
    _count: true,
    orderBy: { _count: { productId: "desc" } },
    take: limit,
  });
  if (grouped.length === 0) return [];

  const productIds = grouped.map((g) => g.productId!);
  const [products, favoriteCounts, saleCounts] = await Promise.all([
    db.product.findMany({ where: { id: { in: productIds } }, select: { id: true, name: true, slug: true } }),
    db.favorite.groupBy({ by: ["productId"], where: { productId: { in: productIds } }, _count: true }),
    db.orderItem.groupBy({
      by: ["productId"],
      where: { productId: { in: productIds }, order: { status: "PAID" } },
      _sum: { quantity: true },
    }),
  ]);

  const productMap = new Map(products.map((p) => [p.id, p]));
  const favoriteMap = new Map(favoriteCounts.map((f) => [f.productId, f._count]));
  const salesMap = new Map(saleCounts.map((s) => [s.productId, s._sum.quantity ?? 0]));

  return grouped
    .filter((g) => productMap.has(g.productId!))
    .map((g) => {
      const product = productMap.get(g.productId!)!;
      const views = g._count;
      const sales = salesMap.get(g.productId!) ?? 0;
      return {
        productId: g.productId!,
        name: product.name,
        slug: product.slug,
        views,
        favorites: favoriteMap.get(g.productId!) ?? 0,
        sales,
        conversionRate: views === 0 ? 0 : sales / views,
      };
    });
}
