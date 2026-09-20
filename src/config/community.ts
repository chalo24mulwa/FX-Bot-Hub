import type { CommunityPostType, CommunityReportReason } from "@prisma/client";

// Community constants in one place (no hard-coded limits/labels in pages —
// same convention as src/config/marketplace.ts).

export const COMMUNITY_HREF = "/community";

export const COMMUNITY_DISCLAIMER =
  "Trading ideas and signals shared by community members are user-generated content and do not constitute financial advice. Trade at your own risk.";

export const LIMITS = {
  TITLE_MIN: 5,
  TITLE_MAX: 180,
  POST_MIN: 10,
  POST_MAX: 10_000,
  COMMENT_MIN: 1,
  COMMENT_MAX: 4_000,
  MAX_TAGS: 5,
  MAX_IMAGES: 4,
  MAX_LINKS_PER_POST: 5,
  MAX_LINKS_PER_COMMENT: 3,
  MAX_MENTIONS: 5,
  /** Replies nest this deep; deeper replies attach to the maximum-depth comment's parent. */
  MAX_COMMENT_DEPTH: 4,
  REPORT_DETAILS_MAX: 1_000,
  BIO_MAX: 300,
} as const;

// Anti-spam ceilings, enforced from the database (Redis-independent — the
// production host has no Redis, and the Redis limiter fails open).
export const POSTING_LIMITS = {
  POSTS_PER_HOUR: 5,
  POSTS_PER_DAY: 15,
  COMMENTS_PER_10_MIN: 15,
  COMMENTS_PER_DAY: 200,
  REPORTS_PER_DAY: 20,
} as const;

export const PAGE_SIZE = 15;

export const POST_TYPES: {
  value: CommunityPostType;
  label: string;
  plural: string;
  description: string;
  /** Carries instrument/direction/price fields. */
  isTrade: boolean;
}[] = [
  { value: "DISCUSSION", label: "Discussion", plural: "Discussions", description: "Ask questions or start a conversation.", isTrade: false },
  { value: "TRADING_IDEA", label: "Trading Idea", plural: "Trading Ideas", description: "Share a market analysis or setup.", isTrade: true },
  { value: "SIGNAL", label: "Signal", plural: "Signals", description: "Share a timely trade setup.", isTrade: true },
  { value: "QUESTION", label: "Question", plural: "Questions", description: "Ask the community for help.", isTrade: false },
  { value: "CHART", label: "Chart / Image", plural: "Charts", description: "Post a TradingView, MT4 or MT5 screenshot.", isTrade: true },
];

export const POST_TYPE_LABEL: Record<CommunityPostType, string> = Object.fromEntries(
  POST_TYPES.map((t) => [t.value, t.label])
) as Record<CommunityPostType, string>;

export function isTradePostType(type: CommunityPostType): boolean {
  return POST_TYPES.find((t) => t.value === type)?.isTrade ?? false;
}

export const TIMEFRAMES = ["M1", "M5", "M15", "M30", "H1", "H4", "D1", "W1", "MN"] as const;

export type FeedSort = "latest" | "trending" | "discussed" | "liked";

export const FEED_SORTS: { value: FeedSort; label: string }[] = [
  { value: "latest", label: "Latest" },
  { value: "trending", label: "Trending" },
  { value: "discussed", label: "Most discussed" },
  { value: "liked", label: "Most liked" },
];

/** Homepage quick sections — presets over the same filters as the feed. */
export const FEED_SECTIONS: { key: string; label: string; href: string }[] = [
  { key: "all", label: "All posts", href: "/community" },
  { key: "ideas", label: "Trading ideas", href: "/community?type=TRADING_IDEA" },
  { key: "signals", label: "Signals & setups", href: "/community?type=SIGNAL" },
  { key: "questions", label: "Questions", href: "/community?type=QUESTION" },
  { key: "ea", label: "EA / Bot talk", href: "/community?category=expert-advisors&category=mt4&category=mt5" },
  { key: "analysis", label: "Market analysis", href: "/community?category=technical-analysis&category=fundamental-analysis" },
  { key: "general", label: "General Forex", href: "/community?category=forex-trading&category=general-discussion" },
];

export const REPORT_REASONS: { value: CommunityReportReason; label: string }[] = [
  { value: "SPAM", label: "Spam" },
  { value: "SCAM", label: "Scam" },
  { value: "HARASSMENT", label: "Harassment" },
  { value: "MISLEADING", label: "Misleading content" },
  { value: "INAPPROPRIATE", label: "Inappropriate content" },
  { value: "FAKE_CLAIM", label: "Fake signal / performance claim" },
  { value: "OTHER", label: "Other" },
];

/** Milestones at which a post's author is told about likes (never one ping per like). */
export const LIKE_NOTIFY_MILESTONES = [1, 5, 10, 25, 50, 100, 250, 500, 1000];
