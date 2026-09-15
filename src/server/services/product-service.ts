import { db } from "@/lib/db";
import { findProducts, productDetailInclude, productListInclude } from "@/repositories/product-repository";
import { listRankedProducts } from "@/lib/ranking/ranking-service";
import { notifyPriceChange } from "@/features/favorites/notify-favoriters";
import { formatPriceCents } from "@/lib/utils";
import { cacheWrap } from "@/lib/cache";
import type { ListProductsQuery, CreateProductInput, UpdateProductInput } from "@/lib/validations/product";
import type { ProductStatus } from "@prisma/client";

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

async function uniqueSlug(name: string, excludeId?: string): Promise<string> {
  const baseSlug = slugify(name);
  let slug = baseSlug;
  let suffix = 1;
  while (true) {
    const existing = await db.product.findUnique({ where: { slug }, select: { id: true } });
    if (!existing || existing.id === excludeId) return slug;
    slug = `${baseSlug}-${suffix++}`;
  }
}

// ---------- Public / buyer-facing ----------

export async function listPublishedProducts(query: ListProductsQuery) {
  if (query.sort === "popular" || query.sort === "best_sellers") {
    return listRankedProducts(query);
  }
  return findProducts(query, { status: "PUBLISHED" });
}

export async function getPublishedProductBySlug(slug: string) {
  return db.product.findFirst({
    where: { slug, status: "PUBLISHED" },
    include: productDetailInclude,
  });
}

/** Fire-and-forget from the product detail page — a lost increment under
 * concurrent load is an acceptable tradeoff for not blocking the render. */
export async function incrementProductView(productId: string) {
  await db.product.update({ where: { id: productId }, data: { viewCount: { increment: 1 } } }).catch(() => {});
}

// Phase 5: both were uncached homepage reads (docs/PHASE5_AUDIT.md). Only
// `updatedAt` from these rows is ever rendered (ProductCard already
// tolerates it arriving as a string after a cache round-trip — see its
// `Date | string` type), so this is safe to cache as plain JSON.
const HOMEPAGE_PRODUCTS_TTL_SECONDS = 120;

export async function listFeaturedProducts(limit: number) {
  return cacheWrap(`featured-products:${limit}`, HOMEPAGE_PRODUCTS_TTL_SECONDS, () =>
    db.product.findMany({
      where: { status: "PUBLISHED", featured: true },
      orderBy: { publishedAt: "desc" },
      take: limit,
      include: productListInclude,
    })
  );
}

export async function listNewestProducts(limit: number) {
  return cacheWrap(`newest-products:${limit}`, HOMEPAGE_PRODUCTS_TTL_SECONDS, () =>
    db.product.findMany({
      where: { status: "PUBLISHED" },
      orderBy: { publishedAt: "desc" },
      take: limit,
      include: productListInclude,
    })
  );
}

// ---------- Seller-facing ----------

export async function createDraftProduct(sellerId: string, input: CreateProductInput) {
  const slug = await uniqueSlug(input.name);
  return db.product.create({
    data: { ...input, sellerId, slug, status: "DRAFT" },
  });
}

export async function updateOwnProduct(sellerId: string, productId: string, input: UpdateProductInput) {
  const product = await db.product.findUnique({
    where: { id: productId },
    select: { sellerId: true, status: true, priceCents: true, name: true, slug: true, currency: true },
  });
  if (!product || product.sellerId !== sellerId) return null;
  // A published listing must go back through review after material edits.
  const resetsReview = product.status === "PUBLISHED" || product.status === "REJECTED";
  const wasPublished = product.status === "PUBLISHED";
  const priceChanged = input.priceCents !== undefined && input.priceCents !== product.priceCents;

  const updated = await db.product.update({
    where: { id: productId },
    data: {
      ...input,
      ...(resetsReview ? { status: "PENDING_REVIEW" as const, rejectionReason: null } : {}),
    },
  });

  if (wasPublished && priceChanged) {
    void notifyPriceChange(
      productId,
      product.name,
      product.slug,
      formatPriceCents(updated.priceCents, updated.currency)
    );
  }

  return updated;
}

export async function submitProductForReview(sellerId: string, productId: string) {
  const result = await db.product.updateMany({
    where: { id: productId, sellerId, status: { in: ["DRAFT", "REJECTED"] } },
    data: { status: "PENDING_REVIEW" },
  });
  return result.count > 0;
}

export async function listSellerProducts(sellerId: string, page: number, pageSize: number) {
  const where = { sellerId };
  const [items, total] = await Promise.all([
    db.product.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: { category: true, rating: true, _count: { select: { orderItems: true, downloads: true } } },
    }),
    db.product.count({ where }),
  ]);
  return { items, total, page, pageSize };
}

export async function getOwnProduct(sellerId: string, productId: string) {
  const product = await db.product.findUnique({ where: { id: productId }, include: productDetailInclude });
  if (!product || product.sellerId !== sellerId) return null;
  return product;
}

// ---------- Admin / moderation ----------

export async function listProductsForModeration(
  status: ProductStatus | undefined,
  page: number,
  pageSize: number
) {
  const where = status ? { status } : {};
  const [items, total] = await Promise.all([
    db.product.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: { seller: { select: { id: true, name: true, email: true } }, category: true },
    }),
    db.product.count({ where }),
  ]);
  return { items, total, page, pageSize };
}
