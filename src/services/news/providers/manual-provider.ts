import type { NewsArticleInput, NewsProvider } from "./types";

// Working default: admin-authored articles created directly at /admin/news
// go straight into NewsArticle, so there's nothing to "sync" from this
// provider — it exists to satisfy the same NewsProvider contract a real
// licensed feed would, keeping newsSync's job logic provider-agnostic.
export class ManualNewsProvider implements NewsProvider {
  readonly key = "manual";

  async getLatest(): Promise<NewsArticleInput[]> {
    return [];
  }
}
