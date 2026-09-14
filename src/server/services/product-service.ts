import { db } from "@/lib/db";
import type { ListProductsQuery, CreateProductInput } from "@/lib/validations/product";
import { Prisma } from "@prisma/client";

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export async function listPublishedProducts(query: ListProductsQuery) {
  const where: Prisma.ProductWhereInput = {
    status: "PUBLISHED",
    type: query.type,
    platform: query.platform,
    category: query.categorySlug ? { slug: query.categorySlug } : undefined,
    ...(query.q
      ? {
          OR: [
            { name: { contains: query.q, mode: "insensitive" } },
            { shortSummary: { contains: query.q, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const [items, total] = await Promise.all([
    db.product.findMany({
      where,
      orderBy: { publishedAt: "desc" },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
      include: { vendor: { select: { name: true } }, category: true },
    }),
    db.product.count({ where }),
  ]);

  return { items, total, page: query.page, pageSize: query.pageSize };
}

export async function getPublishedProductBySlug(slug: string) {
  return db.product.findFirst({
    where: { slug, status: "PUBLISHED" },
    include: {
      vendor: { select: { name: true } },
      category: true,
      images: { orderBy: { position: "asc" } },
      versions: { orderBy: { createdAt: "desc" }, take: 1 },
      reviews: { orderBy: { createdAt: "desc" }, take: 20, include: { user: { select: { name: true } } } },
    },
  });
}

export async function createDraftProduct(vendorId: string, input: CreateProductInput) {
  const baseSlug = slugify(input.name);
  let slug = baseSlug;
  let suffix = 1;
  while (await db.product.findUnique({ where: { slug } })) {
    slug = `${baseSlug}-${suffix++}`;
  }

  return db.product.create({
    data: { ...input, vendorId, slug, status: "DRAFT" },
  });
}
