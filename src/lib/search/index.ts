import type { SearchService } from "./types";
import { PostgresSearchService } from "./postgres-search-service";

export type { SearchService, SearchEntityType, SearchResult, SearchOptions } from "./types";

export const searchService: SearchService = new PostgresSearchService();
