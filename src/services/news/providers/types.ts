export interface NewsArticleInput {
  externalId: string;
  title: string;
  summary: string;
  sourceName: string;
  sourceUrl: string;
  imageUrl?: string;
  currency?: string;
  categorySlug?: string;
  tags?: string[];
  breaking?: boolean;
  publishedAt: Date;
}

export interface NewsProvider {
  key: string;
  getLatest(limit?: number): Promise<NewsArticleInput[]>;
}
