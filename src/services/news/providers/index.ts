import type { NewsProvider } from "./types";
import { ManualNewsProvider } from "./manual-provider";
import { LicensedFeedNewsProvider } from "./licensed-feed-provider";

export type { NewsProvider, NewsArticleInput } from "./types";

const NEWS_PROVIDERS: Record<string, NewsProvider> = {
  manual: new ManualNewsProvider(),
  "licensed-feed": new LicensedFeedNewsProvider(),
};

export function getNewsProvider(key: string): NewsProvider | undefined {
  return NEWS_PROVIDERS[key];
}

export function listNewsProviderKeys(): string[] {
  return Object.keys(NEWS_PROVIDERS);
}
