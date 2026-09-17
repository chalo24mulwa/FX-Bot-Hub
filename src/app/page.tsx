import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { ProductCard } from "@/components/marketplace/product-card";
import { HeroChart } from "@/components/market/hero-chart";
import { cn } from "@/lib/utils";
import { db } from "@/lib/db";
import { listFeaturedProducts, listNewestProducts } from "@/server/services/product-service";
import { MARKETPLACE_CONFIG } from "@/config/marketplace";
import { cacheWrap } from "@/lib/cache";

// Homepage sections are DB-driven and should reflect new listings quickly.
export const dynamic = "force-dynamic";

async function getCategories() {
  return cacheWrap("homepage:categories", 60, () =>
    db.productCategory.findMany({
      where: { parentId: null },
      orderBy: { name: "asc" },
      take: 8,
      include: { _count: { select: { products: true } } },
    })
  );
}

export default async function HomePage() {
  const [featured, newest, categories] = await Promise.all([
    listFeaturedProducts(MARKETPLACE_CONFIG.featuredLimit),
    listNewestProducts(MARKETPLACE_CONFIG.newestLimit),
    getCategories(),
  ]);

  return (
    <main className="flex-1">
      <section className="border-b border-slate-200 bg-gradient-to-b from-slate-50 to-white">
        <div className="mx-auto max-w-6xl px-6 py-12 text-center sm:py-16">
          <h1 className="inline-flex items-center justify-center gap-3 text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl">
            <span className="inline-flex items-center rounded-xl bg-gradient-to-br from-blue-600 via-violet-500 to-emerald-500 px-3 py-1 text-2xl font-black italic text-white shadow-md sm:text-3xl">
              fx
            </span>
            <span className="bg-gradient-to-r from-indigo-600 via-violet-500 to-emerald-500 bg-clip-text italic text-transparent">
              Bot
            </span>
            <span className="text-amber-600">Hub</span>
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-slate-600">
            Expert Advisors, indicators, and trading signals for MT4 &amp; MT5 — plus a live market
            chart and economic calendar to trade around.
          </p>
          <div className="mt-8 flex justify-center gap-3">
            <Link href="/marketplace" className={cn(buttonVariants({ size: "lg" }))}>
              Browse the marketplace
            </Link>
            <Link href="/calendar" className={cn(buttonVariants({ variant: "outline", size: "lg" }))}>
              Economic calendar
            </Link>
          </div>

          <div className="mx-auto mt-10 max-w-4xl text-left">
            <HeroChart defaultSymbol="EUR/USD" />
          </div>
        </div>
      </section>

      {categories.length > 0 && (
        <section className="mx-auto max-w-6xl px-6 py-12">
          <h2 className="text-xl font-semibold text-slate-900">Browse by category</h2>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {categories.map((category) => (
              <Link
                key={category.id}
                href={`/marketplace?categorySlug=${category.slug}`}
                className="rounded-lg border border-slate-200 p-4 text-center transition-colors hover:border-slate-300 hover:bg-slate-50"
              >
                <p className="font-medium text-slate-900">{category.name}</p>
                <p className="text-xs text-slate-500">{category._count.products} products</p>
              </Link>
            ))}
          </div>
        </section>
      )}

      {featured.length > 0 && (
        <section className="mx-auto max-w-6xl px-6 py-12">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-slate-900">Featured products</h2>
            <Link href="/marketplace?featured=true" className="text-sm text-blue-600 hover:underline">
              View all
            </Link>
          </div>
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {featured.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        </section>
      )}

      <section className="mx-auto max-w-6xl px-6 py-12">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold text-slate-900">New arrivals</h2>
          <Link href="/marketplace?sort=newest" className="text-sm text-blue-600 hover:underline">
            View all
          </Link>
        </div>
        {newest.length === 0 ? (
          <p className="mt-4 text-slate-500">
            No products published yet. Seed the database with{" "}
            <code className="rounded bg-slate-100 px-1 py-0.5">npm run db:seed</code>.
          </p>
        ) : (
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {newest.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
