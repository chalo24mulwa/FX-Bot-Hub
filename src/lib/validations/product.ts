import { z } from "zod";

export const productTypeSchema = z.enum(["EXPERT_ADVISOR", "INDICATOR", "SCRIPT", "UTILITY"]);
export const platformTargetSchema = z.enum(["MT4", "MT5", "BOTH"]);

export const createProductSchema = z.object({
  name: z.string().min(3).max(120),
  type: productTypeSchema,
  platform: platformTargetSchema,
  categoryId: z.string().cuid().optional(),
  shortSummary: z.string().min(10).max(200),
  description: z.string().min(20),
  priceCents: z.number().int().min(0),
  currency: z.string().length(3).default("USD"),
});
export type CreateProductInput = z.infer<typeof createProductSchema>;

export const listProductsQuerySchema = z.object({
  q: z.string().optional(),
  type: productTypeSchema.optional(),
  platform: platformTargetSchema.optional(),
  categorySlug: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(20),
});
export type ListProductsQuery = z.infer<typeof listProductsQuerySchema>;
