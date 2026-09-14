import { listProductsQuerySchema } from "@/lib/validations/product";
import { listPublishedProducts } from "@/server/services/product-service";
import { ProductCard } from "@/components/marketplace/product-card";
import { MarketplaceFilters } from "@/components/marketplace/marketplace-filters";
import { Pagination } from "@/components/marketplace/pagination";
import { auth } from "@/lib/auth";
import { listFavoriteProductIds } from "@/features/favorites/favorite-service";

// Listings + search params vary per request; never prerender statically.
export const dynamic = "force-dynamic";

interface MarketplacePageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function MarketplacePage({ searchParams }: MarketplacePageProps) {
  const params = await searchParams;
  const query = listProductsQuerySchema.parse(params);
  const [{ items, total, page, pageSize }, session] = await Promise.all([
    listPublishedProducts(query),
    auth(),
  ]);
  const favoriteIds = session?.user ? await listFavoriteProductIds(session.user.id) : new Set<string>();

  return (
    <main className="mx-auto max-w-6xl flex-1 px-6 py-12">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Marketplace</h1>
          <p className="mt-1 text-sm text-slate-500">
            {total} product{total === 1 ? "" : "s"}
            {query.q ? ` matching "${query.q}"` : ""}
          </p>
        </div>
        <MarketplaceFilters />
      </div>

      {items.length === 0 ? (
        <p className="mt-8 text-slate-500">
          No products found. Try different filters, or seed demo data with{" "}
          <code className="rounded bg-slate-100 px-1 py-0.5">npm run db:seed</code>.
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
    </main>
  );
}
