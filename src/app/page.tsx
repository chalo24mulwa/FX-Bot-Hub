import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { ProductCard } from "@/components/marketplace/product-card";
import { HeroChart } from "@/components/market/hero-chart";
import { cn } from "@/lib/utils";
import { db } from "@/lib/db";
import { listFeaturedProducts, listNewestProducts } from "@/server/services/product-service";
import { MARKETPLACE_CONFIG } from "@/config/marketplace";
import { cacheWrap } from "@/lib/cache";
import { resolveSiteUrl } from "@/lib/site-url";
import { pageMetadata, SITE_DESCRIPTION, SITE_NAME, SITE_TAGLINE } from "@/lib/seo/site";

// Homepage sections are DB-driven and should reflect new listings quickly.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  ...pageMetadata({ title: SITE_TAGLINE, description: SITE_DESCRIPTION, path: "/" }),
  // The brand leads on the homepage instead of the "%s | FX Bot Hub" template.
  title: { absolute: `${SITE_NAME} — ${SITE_TAGLINE}` },
};

// Organization + WebSite structured data: describes only what the page shows (the brand,
// its URL and logo). Rendered as a plain <script>, with "<" escaped so the JSON can't
// close the tag early.
function homeJsonLd() {
  const siteUrl = resolveSiteUrl().replace(/\/$/, "");
  const data = [
    { "@context": "https://schema.org", "@type": "Organization", name: SITE_NAME, url: siteUrl, logo: `${siteUrl}/logo.png` },
    { "@context": "https://schema.org", "@type": "WebSite", name: SITE_NAME, url: siteUrl, description: SITE_DESCRIPTION },
  ];
  return JSON.stringify(data).replace(/</g, "\\u003c");
}

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
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: homeJsonLd() }} />
      <section className="border-b border-slate-200 bg-gradient-to-b from-slate-50 to-white">
        <div className="text-left">
          <HeroChart defaultSymbol="EUR/USD" />
        </div>
        <div className="mx-auto max-w-6xl px-6 py-12 text-center sm:py-16">
          <h1 className="inline-flex items-center justify-center gap-3 text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl">
            <Image
              src="/logo.png"
              alt="FX"
              width={56}
              height={56}
              className="h-12 w-12 sm:h-14 sm:w-14"
              priority
            />
            <span className="bg-gradient-to-r from-indigo-600 via-violet-500 to-emerald-500 bg-clip-text italic text-transparent">
              Bot
            </span>
            <span className="text-amber-600">Hub</span>
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-slate-600">
            Forex trading tools and market intelligence: Expert Advisors, indicators, and trading
            signals for MT4 &amp; MT5 — plus a live market chart and news calendar to trade around.
          </p>
          <div className="mt-8 flex justify-center gap-3">
            <Link href="/marketplace" className={cn(buttonVariants({ size: "lg" }))}>
              Browse the marketplace
            </Link>
            <Link href="/calendar" className={cn(buttonVariants({ variant: "outline", size: "lg" }))}>
              News Calendar
            </Link>
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
            New Expert Advisors and indicators will appear here as sellers publish them.{" "}
            <Link href="/marketplace" className="text-blue-600 hover:underline">
              Browse the marketplace
            </Link>
            .
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
