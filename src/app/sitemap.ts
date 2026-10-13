import type { MetadataRoute } from "next";
import { db } from "@/lib/db";
import { listDistinctCurrencies } from "@/services/calendar/calendar-service";
import { resolveSiteUrl } from "@/lib/site-url";
import { marketplaceLandingPath, SITEMAP_LANDING_COMBOS } from "@/lib/seo/marketplace-landing";
import { GUIDES } from "@/content/guides";

// Built per request from the database, not once at build time — otherwise new products,
// articles and posts wouldn't appear in the sitemap until the next deploy.
export const dynamic = "force-dynamic";

// Same defensive base URL as the root layout's metadataBase (see robots.ts).
const siteUrl = resolveSiteUrl().replace(/\/$/, "");

// Every URL listed here must be a public, indexable page whose own canonical is this
// exact URL. Private areas (/admin, /seller, /dashboard, /cart, /invoices, /auth),
// noindexed "coming soon" stubs (/analysis, /resources/*) and search results are left out.
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [
    products,
    categories,
    landingCounts,
    currencies,
    articles,
    providers,
    communityCategories,
    communityPosts,
  ] = await Promise.all([
    db.product.findMany({
      where: { status: "PUBLISHED" },
      select: { slug: true, updatedAt: true },
      take: 5000,
    }),
    // Only categories that actually list something — an empty category page is thin content.
    db.productCategory.findMany({
      where: { products: { some: { status: "PUBLISHED" } } },
      select: { slug: true },
    }),
    db.product.groupBy({
      by: ["platform", "type"],
      where: { status: "PUBLISHED" },
      _count: { _all: true },
    }),
    listDistinctCurrencies(),
    db.newsArticle.findMany({
      where: { status: "PUBLISHED" },
      select: { slug: true, updatedAt: true },
      take: 5000,
    }),
    db.signalProviderProfile.findMany({ select: { slug: true, updatedAt: true } }),
    db.communityCategory.findMany({ where: { isActive: true }, select: { slug: true } }),
    db.communityPost.findMany({
      where: { status: "PUBLISHED" },
      select: { id: true, updatedAt: true },
      orderBy: { createdAt: "desc" },
      take: 2000,
    }),
  ]);

  const url = (path: string) => `${siteUrl}${path === "/" ? "" : path}`;

  // MT4/MT5 EA and indicator landing views (the header's Marketplace links), listed
  // only once they have at least one published product.
  const hasProducts = (platform: string | undefined, type: string) =>
    landingCounts.some((row) => row.type === type && (!platform || row.platform === platform) && row._count._all > 0);
  const landingPages = SITEMAP_LANDING_COMBOS.filter((combo) => hasProducts(combo.platform, combo.type)).map((combo) => ({
    url: url(marketplaceLandingPath(combo)),
    changeFrequency: "daily" as const,
    priority: 0.7,
  }));

  return [
    { url: url("/"), changeFrequency: "daily", priority: 1 },
    { url: url("/marketplace"), changeFrequency: "daily", priority: 0.9 },
    { url: url("/calendar"), changeFrequency: "hourly", priority: 0.8 },
    { url: url("/news"), changeFrequency: "hourly", priority: 0.7 },
    { url: url("/intelligence"), changeFrequency: "hourly", priority: 0.6 },
    { url: url("/signals"), changeFrequency: "hourly", priority: 0.6 },
    { url: url("/community"), changeFrequency: "hourly", priority: 0.6 },
    { url: url("/developer-resources"), changeFrequency: "monthly", priority: 0.6 },
    { url: url("/guides"), changeFrequency: "weekly", priority: 0.7 },
    ...GUIDES.map((g) => ({
      url: url(`/guides/${g.slug}`),
      lastModified: new Date(`${g.updated}T00:00:00Z`),
      changeFrequency: "monthly" as const,
      priority: 0.6,
    })),
    ...landingPages,
    ...categories.map((c) => ({
      url: url(marketplaceLandingPath({ categorySlug: c.slug })),
      changeFrequency: "daily" as const,
      priority: 0.6,
    })),
    ...products.map((p) => ({
      url: url(`/marketplace/${p.slug}`),
      lastModified: p.updatedAt,
      changeFrequency: "weekly" as const,
      priority: 0.8,
    })),
    ...currencies.map((code) => ({
      url: url(`/calendar/${code.toLowerCase()}`),
      changeFrequency: "hourly" as const,
      priority: 0.5,
    })),
    ...articles.map((a) => ({
      url: url(`/news/${a.slug}`),
      lastModified: a.updatedAt,
      changeFrequency: "daily" as const,
      priority: 0.6,
    })),
    ...providers.map((p) => ({
      url: url(`/signals/provider/${p.slug}`),
      lastModified: p.updatedAt,
      changeFrequency: "weekly" as const,
      priority: 0.5,
    })),
    ...communityCategories.map((c) => ({
      url: url(`/community/c/${c.slug}`),
      changeFrequency: "daily" as const,
      priority: 0.5,
    })),
    ...communityPosts.map((p) => ({
      url: url(`/community/post/${p.id}`),
      lastModified: p.updatedAt,
      changeFrequency: "weekly" as const,
      priority: 0.4,
    })),
  ];
}
