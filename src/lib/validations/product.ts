import { z } from "zod";

export const productTypeSchema = z.enum(["EA", "INDICATOR", "SIGNAL", "TOOL", "OTHER"]);
export const platformSchema = z.enum(["MT4", "MT5", "MULTI_PLATFORM"]);
export const pricingTypeSchema = z.enum(["FREE", "ONE_TIME", "SUBSCRIPTION"]);

export const productSortSchema = z.enum([
  "newest",
  "updated",
  "rating",
  "popular",
  "price_asc",
  "price_desc",
]);

const productFieldsSchema = z.object({
  name: z.string().min(3).max(120),
  type: productTypeSchema,
  platform: platformSchema,
  categoryId: z.string().cuid().optional(),
  shortSummary: z.string().min(10).max(200),
  description: z.string().min(20),
  pricingType: pricingTypeSchema.default("ONE_TIME"),
  priceCents: z.number().int().min(0),
  currency: z.string().length(3).default("USD"),
  tags: z.array(z.string().min(1).max(40)).max(10).default([]),
});

const freeMeansZeroPrice = (data: { pricingType: string; priceCents: number }) =>
  data.pricingType !== "FREE" || data.priceCents === 0;

export const createProductSchema = productFieldsSchema.refine(freeMeansZeroPrice, {
  message: "priceCents must be 0 when pricingType is FREE",
  path: ["priceCents"],
});
export type CreateProductInput = z.infer<typeof createProductSchema>;

export const updateProductSchema = productFieldsSchema.partial();
export type UpdateProductInput = z.infer<typeof updateProductSchema>;

// Reusable marketplace filter contract — the query/filter service and every
// list endpoint (public marketplace, admin, seller) build on this same
// shape, so a new filter is added here once rather than per page.
export const listProductsQuerySchema = z.object({
  q: z.string().optional(),
  type: productTypeSchema.optional(),
  platform: platformSchema.optional(),
  pricingType: pricingTypeSchema.optional(),
  categorySlug: z.string().optional(),
  minPriceCents: z.coerce.number().int().min(0).optional(),
  maxPriceCents: z.coerce.number().int().min(0).optional(),
  minRating: z.coerce.number().min(0).max(5).optional(),
  featured: z.coerce.boolean().optional(),
  sellerId: z.string().cuid().optional(),
  sort: productSortSchema.default("newest"),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(20),
});
export type ListProductsQuery = z.infer<typeof listProductsQuerySchema>;
