import { db } from "@/lib/db";
import type { SearchEntityType, SearchOptions, SearchResult, SearchService } from "./types";

const ALL_TYPES: SearchEntityType[] = ["product", "news", "signal"];

// Postgres full-text search over products.searchVector (a tsvector kept in
// sync by a DB trigger — see prisma/migrations/*_search_indexes). Swap this
// implementation for an Elasticsearch/OpenSearch-backed one later by
// implementing SearchService and changing the export in ./index — nothing
// outside this folder should need to change.
export class PostgresSearchService implements SearchService {
  async searchProductIds(query: string, limit = 50): Promise<string[]> {
    const trimmed = query.trim();
    if (!trimmed) return [];

    const rows = await db.$queryRaw<{ id: string }[]>`
      SELECT id FROM products
      WHERE "searchVector" @@ websearch_to_tsquery('english', ${trimmed})
      ORDER BY ts_rank("searchVector", websearch_to_tsquery('english', ${trimmed})) DESC
      LIMIT ${limit}
    `;

    if (rows.length > 0) return rows.map((r) => r.id);

    // Fallback for short/partial queries that websearch_to_tsquery treats as
    // empty (e.g. a single 2-letter token) — trigram similarity on name.
    const fallback = await db.$queryRaw<{ id: string }[]>`
      SELECT id FROM products
      WHERE name ILIKE ${"%" + trimmed + "%"}
      ORDER BY similarity(name, ${trimmed}) DESC
      LIMIT ${limit}
    `;
    return fallback.map((r) => r.id);
  }

  /**
   * News and signals don't have a tsvector column of their own (no DB
   * trigger keeping one in sync, unlike products) — this uses a plain
   * ILIKE match instead of true full-text ranking for those two. Real
   * typo-tolerant/ranked full-text search for them is the same shape of
   * work the *product* trigram/tsvector migration already did; deferred
   * as a follow-up rather than half-built here (see docs/PHASE5_AUDIT.md).
   */
  async search(query: string, options: SearchOptions = {}): Promise<SearchResult[]> {
    const trimmed = query.trim();
    if (!trimmed) return [];
    const types = options.types ?? ALL_TYPES;
    const limit = Math.min(options.limit ?? 20, 50);

    const results = await Promise.all([
      types.includes("product") ? this.searchProducts(trimmed, limit) : Promise.resolve([]),
      types.includes("news") ? this.searchNews(trimmed, limit) : Promise.resolve([]),
      types.includes("signal") ? this.searchSignals(trimmed, limit) : Promise.resolve([]),
    ]);

    return results.flat();
  }

  private async searchProducts(query: string, limit: number): Promise<SearchResult[]> {
    const ids = await this.searchProductIds(query, limit);
    if (ids.length === 0) return [];
    const products = await db.product.findMany({
      where: { id: { in: ids }, status: "PUBLISHED" },
      select: { id: true, name: true, slug: true, shortSummary: true },
    });
    const order = new Map(ids.map((id, i) => [id, i]));
    return products
      .sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0))
      .map((p) => ({
        id: p.id,
        type: "product" as const,
        title: p.name,
        subtitle: p.shortSummary,
        url: `/marketplace/${p.slug}`,
      }));
  }

  private async searchNews(query: string, limit: number): Promise<SearchResult[]> {
    const articles = await db.newsArticle.findMany({
      where: {
        status: "PUBLISHED",
        OR: [{ title: { contains: query, mode: "insensitive" } }, { summary: { contains: query, mode: "insensitive" } }],
      },
      orderBy: { publishedAt: "desc" },
      take: limit,
      select: { id: true, title: true, slug: true, sourceName: true },
    });
    return articles.map((a) => ({
      id: a.id,
      type: "news" as const,
      title: a.title,
      subtitle: a.sourceName,
      url: `/news/${a.slug}`,
    }));
  }

  private async searchSignals(query: string, limit: number): Promise<SearchResult[]> {
    const signals = await db.signal.findMany({
      where: {
        status: { not: "CANCELLED" },
        OR: [
          { instrument: { contains: query, mode: "insensitive" } },
          { provider: { displayName: { contains: query, mode: "insensitive" } } },
        ],
      },
      orderBy: { publishedAt: "desc" },
      take: limit,
      select: { id: true, instrument: true, direction: true, provider: { select: { displayName: true } } },
    });
    return signals.map((s) => ({
      id: s.id,
      type: "signal" as const,
      title: `${s.instrument} ${s.direction}`,
      subtitle: s.provider.displayName,
      url: `/signals/${s.id}`,
    }));
  }
}
