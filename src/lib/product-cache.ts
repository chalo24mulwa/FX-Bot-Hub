import { invalidateCachePrefix } from "@/lib/cache";

/**
 * The public reads that depend on a product's data. Anything that changes what a visitor should see — a product's content or price,
 * its moderation state, its rating — calls this, so the change shows at once instead of after the cache's TTL.
 */
export const PRODUCT_CACHE_PREFIXES = ["ranked-products:", "featured-products:", "newest-products:", "product:", "homepage:", "marketplace:"] as const;

export function invalidateProductCaches(): void {
  invalidateCachePrefix(...PRODUCT_CACHE_PREFIXES);
}
