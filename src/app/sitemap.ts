import type { MetadataRoute } from "next";
import { db } from "@/lib/db";
import { listDistinctCurrencies } from "@/services/calendar/calendar-service";

const siteUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [products, categories, currencies, articles, providers, communityCategories, communityPosts] = await Promise.all([
    db.product.findMany({
      where: { status: "PUBLISHED" },
      select: { slug: true, updatedAt: true },
      take: 5000,
    }),
    db.productCategory.findMany({ select: { slug: true } }),
    listDistinctCurrencies(),
    db.newsArticle.findMany({
      where: { status: "PUBLISHED" },
      select: { slug: true, updatedAt: true },
      take: 5000,
    }),
    db.signalProviderProfile.findMany({ select: { slug: true, updatedAt: true } }),
    db.communityCategory.findMany({ where: { isActive: true }, select: { slug: true } }),
    db.communityPost.findMany({ where: { status: "PUBLISHED" }, select: { id: true, updatedAt: true }, orderBy: { createdAt: "desc" }, take: 2000 }),
  ]);

  return [
    { url: siteUrl, changeFrequency: "daily", priority: 1 },
    { url: `${siteUrl}/marketplace`, changeFrequency: "hourly", priority: 0.9 },
    { url: `${siteUrl}/calendar`, changeFrequency: "hourly", priority: 0.7 },
    { url: `${siteUrl}/news`, changeFrequency: "hourly", priority: 0.7 },
    { url: `${siteUrl}/signals`, changeFrequency: "hourly", priority: 0.6 },
    { url: `${siteUrl}/community`, changeFrequency: "hourly", priority: 0.6 },
    ...communityCategories.map((c) => ({ url: `${siteUrl}/community/c/${c.slug}`, changeFrequency: "daily" as const, priority: 0.5 })),
    ...communityPosts.map((p) => ({ url: `${siteUrl}/community/post/${p.id}`, lastModified: p.updatedAt, changeFrequency: "weekly" as const, priority: 0.4 })),
    ...categories.map((c) => ({
      url: `${siteUrl}/marketplace?categorySlug=${c.slug}`,
      changeFrequency: "daily" as const,
      priority: 0.6,
    })),
    ...products.map((p) => ({
      url: `${siteUrl}/marketplace/${p.slug}`,
      lastModified: p.updatedAt,
      changeFrequency: "weekly" as const,
      priority: 0.8,
    })),
    ...currencies.map((code) => ({
      url: `${siteUrl}/calendar/${code.toLowerCase()}`,
      changeFrequency: "hourly" as const,
      priority: 0.5,
    })),
    ...articles.map((a) => ({
      url: `${siteUrl}/news/${a.slug}`,
      lastModified: a.updatedAt,
      changeFrequency: "daily" as const,
      priority: 0.6,
    })),
    ...providers.map((p) => ({
      url: `${siteUrl}/signals/provider/${p.slug}`,
      lastModified: p.updatedAt,
      changeFrequency: "weekly" as const,
      priority: 0.5,
    })),
  ];
}
