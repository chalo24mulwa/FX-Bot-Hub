import type { Metadata } from "next";
import { listProductsQuerySchema } from "@/lib/validations/product";
import { listPublishedProducts } from "@/server/services/product-service";
import { ProductCard } from "@/components/marketplace/product-card";
import { MarketplaceFilters } from "@/components/marketplace/marketplace-filters";
import { PartnershipInlineLink } from "@/components/partnership/partnership-cta";
import { Pagination } from "@/components/marketplace/pagination";
import { auth } from "@/lib/auth";
import { listFavoriteProductIds } from "@/features/favorites/favorite-service";
import { track } from "@/lib/analytics/track";
import { db } from "@/lib/db";
import { describeMarketplaceLanding } from "@/lib/seo/marketplace-landing";
import { pageMetadata } from "@/lib/seo/site";

// Listings + search params vary per request; never prerender statically.
export const dynamic = "force-dynamic";

interface MarketplacePageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

async function resolveLanding(params: Record<string, string | string[] | undefined>) {
  const query = listProductsQuerySchema.parse(params);
  const category = query.categorySlug
    ? await db.productCategory.findUnique({ where: { slug: query.categorySlug }, select: { name: true } })
    : null;
  const landing = describeMarketplaceLanding({
    platform: query.platform,
    type: query.type,
    categorySlug: category ? query.categorySlug : undefined,
    categoryName: category?.name,
    q: query.q,
    page: query.page,
  });
  return { query, landing };
}

export async function generateMetadata({ searchParams }: MarketplacePageProps): Promise<Metadata> {
  const { landing } = await resolveLanding(await searchParams);
  return pageMetadata({
    title: landing.title,
    description: landing.description,
    path: landing.canonicalPath,
    noindex: landing.noindex,
  });
}

export default async function MarketplacePage({ searchParams }: MarketplacePageProps) {
  const params = await searchParams;
  const { query, landing } = await resolveLanding(params);
  const [{ items, total, page, pageSize }, session] = await Promise.all([
    listPublishedProducts(query),
    auth(),
  ]);
  const favoriteIds = session?.user ? await listFavoriteProductIds(session.user.id) : new Set<string>();

  if (query.q) {
    void track({ type: "SEARCH", userId: session?.user.id, metadata: { query: query.q, resultCount: total } });
  }

  return (
    <main className="mx-auto max-w-6xl flex-1 px-6 py-12">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">{landing.heading}</h1>
          <p className="mt-1 text-sm text-slate-500">
            {total} product{total === 1 ? "" : "s"}
            {query.q ? ` matching "${query.q}"` : ""}
          </p>
        </div>
        <MarketplaceFilters />
      </div>

      {items.length === 0 ? (
        <p className="mt-8 text-slate-500">
          No products match these filters yet. Try different filters, or check back soon as sellers
          publish new Expert Advisors and indicators.
        </p>
      ) : (
        <>
          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((product) => (
              <ProductCard key={product.id} product={product} isFavorited={favoriteIds.has(product.id)} />
            ))}
          </div>
          <Pagination page={page} pageSize={pageSize} total={total} basePath="/marketplace" searchParams={params} />
        </>
      )}
      <PartnershipInlineLink
        placement="marketplace"
        lead="Know traders who'd use tools like these? Share FXBotHub and earn commission on eligible referred sales —"
        label="become an FXBotHub Partner"
        className="mt-10 border-t border-slate-200 pt-6 text-center"
      />
    </main>
  );
}
