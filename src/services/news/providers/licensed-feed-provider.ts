import type { NewsArticleInput, NewsProvider } from "./types";

// STUB — template for a licensed news wire/API integration (e.g. a
// newswire API you have redistribution rights for). Never scrapes a site;
// only ever calls an API under license. Store summaries + attribution only
// (see NewsArticle's comment in schema.prisma) — never full article bodies
// unless the license explicitly permits it.
export class LicensedFeedNewsProvider implements NewsProvider {
  readonly key = "licensed-feed";

  async getLatest(_limit?: number): Promise<NewsArticleInput[]> {
    throw new Error(
      "licensed-feed news provider is not configured. Set its API key/endpoint and " +
        "implement this method before enabling it in /admin/data-sources."
    );
  }
}
