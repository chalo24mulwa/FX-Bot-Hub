import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { searchService } from "@/lib/search";
import type { ListProductsQuery } from "@/lib/validations/product";

// Fields every public-facing product list needs; kept in one place so a new
// list surface (marketplace, seller "my products", admin moderation queue)
// doesn't have to redeclare the include shape.
const sellerCardSelect = {
  id: true,
  name: true,
  sellerProfile: { select: { verified: true } },
} satisfies Prisma.UserSelect;

// Just the cover (ProductImage position 0) — for surfaces that select their
// own product columns but still show the cover thumbnail next to the title.
export const productCoverSelect = {
  orderBy: { position: "asc" as const },
  take: 1,
  select: { storageKey: true, altText: true },
} satisfies Prisma.Product$imagesArgs;

export const productListInclude = {
  seller: { select: sellerCardSelect },
  category: true,
  images: { orderBy: { position: "asc" as const }, take: 1 },
  rating: true,
} satisfies Prisma.ProductInclude;

export const productDetailInclude = {
  seller: { select: sellerCardSelect },
  category: true,
  images: { orderBy: { position: "asc" as const } },
  screenshots: { orderBy: { position: "asc" as const } },
  documentation: { orderBy: { position: "asc" as const } },
  versions: { orderBy: { createdAt: "desc" as const }, take: 20, include: { files: true } },
  reviews: {
    where: { hidden: false },
    orderBy: { createdAt: "desc" as const },
    take: 50,
    include: { user: { select: { name: true } } },
  },
  rating: true,
} satisfies Prisma.ProductInclude;

function sortToOrderBy(sort: ListProductsQuery["sort"]): Prisma.ProductOrderByWithRelationInput {
  switch (sort) {
    case "updated":
      return { updatedAt: "desc" };
    case "price_asc":
      return { priceCents: "asc" };
    case "price_desc":
      return { priceCents: "desc" };
    case "rating":
      return { rating: { average: "desc" } };
    case "popular":
      // Proxy for popularity until real sales/download counters are rolled
      // up; downloads is indexed on productId so this stays cheap.
      return { downloads: { _count: "desc" } };
    case "newest":
    default:
      return { publishedAt: "desc" };
  }
}

/**
 * Reusable marketplace filter/query builder. Every list surface (public
 * marketplace, seller dashboard, admin moderation) composes its `where`
 * from this instead of hand-rolling Prisma filters per page — add a new
 * filter to ListProductsQuery + here once, and it's available everywhere.
 */
export async function buildProductWhere(
  query: ListProductsQuery,
  extra?: Prisma.ProductWhereInput
): Promise<Prisma.ProductWhereInput> {
  const where: Prisma.ProductWhereInput = {
    type: query.type,
    platform: query.platform,
    pricingType: query.pricingType,
    featured: query.featured,
    sellerId: query.sellerId,
    category: query.categorySlug ? { slug: query.categorySlug } : undefined,
    priceCents:
      query.minPriceCents !== undefined || query.maxPriceCents !== undefined
        ? { gte: query.minPriceCents, lte: query.maxPriceCents }
        : undefined,
    rating: query.minRating !== undefined ? { average: { gte: query.minRating } } : undefined,
    ...extra,
  };

  if (query.q) {
    const ids = await searchService.searchProductIds(query.q, 200);
    where.id = { in: ids };
  }

  return where;
}

export async function findProducts(query: ListProductsQuery, extra?: Prisma.ProductWhereInput) {
  const where = await buildProductWhere(query, extra);

  const [items, total] = await Promise.all([
    db.product.findMany({
      where,
      orderBy: sortToOrderBy(query.sort),
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
      include: productListInclude,
    }),
    db.product.count({ where }),
  ]);

  return { items, total, page: query.page, pageSize: query.pageSize };
}
