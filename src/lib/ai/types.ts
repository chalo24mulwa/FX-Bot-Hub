/**
 * AI-readiness interfaces (Phase 5 — docs/PHASE5_AUDIT.md). These are
 * content-assistance operations only — summarization, recommendations,
 * semantic search, tagging, duplicate detection. Deliberately excludes
 * anything that would generate or auto-execute a trade, a signal's
 * direction/entry/stop, or any other financial-advice-shaped output — the
 * Phase 5 brief explicitly rules that out ("Do NOT build unsafe automated
 * trading systems"), and no interface here should grow into one later
 * without that being a distinct, deliberate decision.
 */

export interface SummarizeInput {
  text: string;
  maxSentences?: number;
}

export interface SummarizeResult {
  summary: string;
}

export interface RecommendationInput {
  /** Recommend based on this user's activity (favorites/purchases), when known. */
  userId?: string;
  /** Recommend products similar to this one — the common "related products" case. */
  productId?: string;
  limit?: number;
}

export interface RecommendationResult {
  productIds: string[];
}

export interface TagContentInput {
  title: string;
  body: string;
}

export interface TagContentResult {
  tags: string[];
}

export interface DuplicateCheckInput {
  text: string;
  /** Candidate ids to compare against — callers narrow this (e.g. same
   * category) rather than handing over the whole catalog. */
  candidateIds: string[];
}

export interface DuplicateCheckResult {
  /** Empty when nothing looks like a duplicate. */
  matches: { id: string; similarity: number }[];
}

export interface AIProvider {
  readonly name: string;
  summarize(input: SummarizeInput): Promise<SummarizeResult>;
  recommendProducts(input: RecommendationInput): Promise<RecommendationResult>;
  tagContent(input: TagContentInput): Promise<TagContentResult>;
  detectDuplicateContent(input: DuplicateCheckInput): Promise<DuplicateCheckResult>;
}
