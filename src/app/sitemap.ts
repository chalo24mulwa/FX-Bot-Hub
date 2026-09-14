import type { MetadataRoute } from "next";
import { db } from "@/lib/db";

const siteUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [products, categories] = await Promise.all([
    db.product.findMany({
      where: { status: "PUBLISHED" },
      select: { slug: true, updatedAt: true },
      take: 5000,
    }),
    db.productCategory.findMany({ select: { slug: true } }),
  ]);

  return [
    { url: siteUrl, changeFrequency: "daily", priority: 1 },
    { url: `${siteUrl}/marketplace`, changeFrequency: "hourly", priority: 0.9 },
    { url: `${siteUrl}/calendar`, changeFrequency: "hourly", priority: 0.7 },
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
  ];
}
