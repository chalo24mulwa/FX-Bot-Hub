import type {
  AIProvider,
  DuplicateCheckInput,
  DuplicateCheckResult,
  RecommendationInput,
  RecommendationResult,
  SummarizeInput,
  SummarizeResult,
  TagContentInput,
  TagContentResult,
} from "./types";

// Honest stub — same pattern as src/lib/payments/stripe-provider.ts and
// mpesa-provider.ts: the interface and registry exist now so a real
// provider (an LLM API) is a new class + one line in ./index, not a
// redesign of every call site. Nothing calls this yet; wiring it up to a
// real feature (news/calendar summaries, product recommendations, content
// tagging, duplicate-listing detection) is future Phase work.
export class NoopAIProvider implements AIProvider {
  readonly name = "noop";

  async summarize(_input: SummarizeInput): Promise<SummarizeResult> {
    throw new Error("AI provider not configured.");
  }

  async recommendProducts(_input: RecommendationInput): Promise<RecommendationResult> {
    throw new Error("AI provider not configured.");
  }

  async tagContent(_input: TagContentInput): Promise<TagContentResult> {
    throw new Error("AI provider not configured.");
  }

  async detectDuplicateContent(_input: DuplicateCheckInput): Promise<DuplicateCheckResult> {
    throw new Error("AI provider not configured.");
  }
}
