export interface SearchService {
  /** Ranked product ids matching the query, best match first. */
  searchProductIds(query: string, limit?: number): Promise<string[]>;
}
