import { db } from "@/lib/db";
import type { Prisma } from "@prisma/client";

export interface ListArticlesQuery {
  categorySlug?: string;
  currency?: string;
  breaking?: boolean;
  page?: number;
  pageSize?: number;
}

export async function listPublishedArticles(query: ListArticlesQuery) {
  const page = query.page ?? 1;
  const pageSize = Math.min(query.pageSize ?? 20, 50);

  const where: Prisma.NewsArticleWhereInput = {
    status: "PUBLISHED",
    category: query.categorySlug ? { slug: query.categorySlug } : undefined,
    currency: query.currency,
    breaking: query.breaking,
  };

  const [items, total] = await Promise.all([
    db.newsArticle.findMany({
      where,
      orderBy: { publishedAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: { category: true },
    }),
    db.newsArticle.count({ where }),
  ]);
  return { items, total, page, pageSize };
}

export async function getArticleBySlug(slug: string) {
  return db.newsArticle.findFirst({ where: { slug, status: "PUBLISHED" }, include: { category: true } });
}

export async function listBreakingNews(limit = 5) {
  return db.newsArticle.findMany({
    where: { status: "PUBLISHED", breaking: true },
    orderBy: { publishedAt: "desc" },
    take: limit,
  });
}

export async function listLatestNews(limit = 6) {
  return db.newsArticle.findMany({
    where: { status: "PUBLISHED" },
    orderBy: { publishedAt: "desc" },
    take: limit,
    include: { category: true },
  });
}

export async function listCategories() {
  return db.newsCategory.findMany({ orderBy: { name: "asc" } });
}
