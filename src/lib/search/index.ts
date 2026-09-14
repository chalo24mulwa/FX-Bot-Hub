import type { SearchService } from "./types";
import { PostgresSearchService } from "./postgres-search-service";

export type { SearchService } from "./types";

export const searchService: SearchService = new PostgresSearchService();
