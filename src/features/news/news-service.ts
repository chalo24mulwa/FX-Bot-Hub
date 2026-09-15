import { db } from "@/lib/db";
import type { Prisma } from "@prisma/client";
import { cacheWrap } from "@/lib/cache";

export interface ListArticlesQuery {
  categorySlug?: string;
  currency?: string;
  breaking?: boolean;
  page?: number;
  pageSize?: number;
}

const PUBLISHED_ARTICLES_TTL_SECONDS = 120;

// Phase 5: the news list page calls `article.publishedAt?.toLocaleDateString()`
// directly (no Date|string tolerance) — a cache hit would otherwise hand it
// a string and crash. `new Date(x)` is safe whether `x` is already a Date
// or a string, and `publishedAt` is nullable so that's preserved too.
function reviveArticleDates<T extends { publishedAt: Date | string | null }>(article: T): T {
  return { ...article, publishedAt: article.publishedAt ? new Date(article.publishedAt) : null };
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

  const { items, total } = await cacheWrap(
    `published-articles:${JSON.stringify({ ...query, page, pageSize })}`,
    PUBLISHED_ARTICLES_TTL_SECONDS,
    async () => {
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
      return { items, total };
    }
  );
  return { items: items.map(reviveArticleDates), total, page, pageSize };
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
  return cacheWrap("news-categories", PUBLISHED_ARTICLES_TTL_SECONDS, () =>
    db.newsCategory.findMany({ orderBy: { name: "asc" } })
  );
}
