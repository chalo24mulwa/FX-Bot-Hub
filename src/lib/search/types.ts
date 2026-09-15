export type SearchEntityType = "product" | "news" | "signal";

export interface SearchResult {
  id: string;
  type: SearchEntityType;
  title: string;
  subtitle?: string;
  url: string;
}

export interface SearchOptions {
  types?: SearchEntityType[];
  limit?: number;
}

export interface SearchService {
  /** Ranked product ids matching the query, best match first — the
   * marketplace listing's own filter uses this directly (see
   * buildProductWhere in src/repositories/product-repository.ts). */
  searchProductIds(query: string, limit?: number): Promise<string[]>;
  /**
   * Cross-entity search (Phase 5 — docs/PHASE5_AUDIT.md's SearchService
   * abstraction requirement): products, news, and signals today; "guides"
   * from the Phase 5 brief has no backing content model in this app
   * (Guides/Tutorials/Developer-Resources are still stub pages — see
   * CLAUDE.md's Known follow-ups), so it isn't a search target. A
   * "developers" (seller) search target is likewise not implemented yet —
   * see docs/PHASE5_AUDIT.md for what's deferred and why. Swapping to
   * OpenSearch/Elasticsearch later means implementing this same interface
   * and changing the export in ./index — nothing outside this folder
   * should need to change.
   */
  search(query: string, options?: SearchOptions): Promise<SearchResult[]>;
}
