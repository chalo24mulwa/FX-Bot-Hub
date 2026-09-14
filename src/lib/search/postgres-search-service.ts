import { db } from "@/lib/db";
import type { SearchService } from "./types";

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
}
