import type { AIProvider } from "./types";
import { NoopAIProvider } from "./noop-provider";

export type {
  AIProvider,
  SummarizeInput,
  SummarizeResult,
  RecommendationInput,
  RecommendationResult,
  TagContentInput,
  TagContentResult,
  DuplicateCheckInput,
  DuplicateCheckResult,
} from "./types";

// No AI_PROVIDER env selection yet — there is exactly one implementation
// (the stub) until a real one exists. Add an env-driven switch here
// (matching src/lib/payments/index.ts's createPaymentProvider()) once
// there's a second implementation to choose between.
export const aiProvider: AIProvider = new NoopAIProvider();
