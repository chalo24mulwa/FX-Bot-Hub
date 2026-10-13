/**
 * Search-friendly landing views of /marketplace (e.g. "MT4 Expert Advisors").
 *
 * The header's Marketplace menu links to filtered views such as
 * `/marketplace?platform=MT4&type=EA`. Each meaningful filter combination gets its own
 * title, description, heading and a canonical URL that keeps only the parameters that
 * define the page (platform, type, category, page). Sort order, free-text search and
 * other display filters are dropped from the canonical so they don't compete with it as
 * duplicate pages; free-text search results are additionally noindex.
 *
 * Pure (no I/O) so it's unit-tested in marketplace-landing.test.ts. The sitemap uses the
 * same `marketplaceLandingPath()` so its URLs always equal the pages' own canonicals.
 */

export type LandingPlatform = "MT4" | "MT5";
export type LandingType = "EA" | "INDICATOR" | "SIGNAL" | "TOOL";

export interface MarketplaceLandingInput {
  platform?: string;
  type?: string;
  categorySlug?: string;
  categoryName?: string;
  q?: string;
  page?: number;
}

export interface MarketplaceLanding {
  title: string;
  heading: string;
  description: string;
  canonicalPath: string;
  noindex: boolean;
}

const PLATFORMS: readonly LandingPlatform[] = ["MT4", "MT5"];
const TYPES: readonly LandingType[] = ["EA", "INDICATOR", "SIGNAL", "TOOL"];

const PLATFORM_LONG: Record<LandingPlatform, string> = { MT4: "MetaTrader 4", MT5: "MetaTrader 5" };

const TYPE_HEADING: Record<LandingType, string> = {
  EA: "Expert Advisors",
  INDICATOR: "Indicators",
  SIGNAL: "Signal Tools",
  TOOL: "Trading Tools",
};

const TYPE_BLURB: Record<LandingType, string> = {
  EA: "Expert Advisors (EAs) — automated trading robots",
  INDICATOR: "technical indicators",
  SIGNAL: "trading signal tools",
  TOOL: "trading tools and utilities",
};

function asPlatform(value?: string): LandingPlatform | undefined {
  return PLATFORMS.find((p) => p === value);
}

function asType(value?: string): LandingType | undefined {
  return TYPES.find((t) => t === value);
}

/** Canonical path for a landing view; parameters always appear in this fixed order. */
export function marketplaceLandingPath(input: { platform?: string; type?: string; categorySlug?: string; page?: number }): string {
  const params = new URLSearchParams();
  const platform = asPlatform(input.platform);
  const type = asType(input.type);
  if (platform) params.set("platform", platform);
  if (type) params.set("type", type);
  if (input.categorySlug) params.set("categorySlug", input.categorySlug);
  if (input.page && input.page > 1) params.set("page", String(input.page));
  const query = params.toString();
  return query ? `/marketplace?${query}` : "/marketplace";
}

export function describeMarketplaceLanding(input: MarketplaceLandingInput): MarketplaceLanding {
  const platform = asPlatform(input.platform);
  const type = asType(input.type);
  const canonicalPath = marketplaceLandingPath(input);
  const noindex = Boolean(input.q && input.q.trim());

  let heading = "Marketplace";
  let title = "Forex EA and Indicator Marketplace";
  let description =
    "Browse MT4 and MT5 Expert Advisors, trading indicators and signal tools from independent developers, with product documentation, reviews and license management.";

  if (type) {
    const what = TYPE_HEADING[type];
    heading = platform ? `${platform} ${what}` : what;
    title = platform ? `${platform} ${what}` : `${what} for MT4 and MT5`;
    description = platform
      ? `Browse ${PLATFORM_LONG[platform]} (${platform}) ${TYPE_BLURB[type]} listed on FX Bot Hub, with product details, reviews and license management.`
      : `Browse ${TYPE_BLURB[type]} for MetaTrader 4 and MetaTrader 5 listed on FX Bot Hub, with product details, reviews and license management.`;
  } else if (platform) {
    heading = `${platform} Products`;
    title = `${platform} Expert Advisors and Indicators`;
    description = `Browse ${PLATFORM_LONG[platform]} (${platform}) Expert Advisors, indicators and trading tools listed on FX Bot Hub.`;
  }

  if (input.categoryName) {
    heading = input.categoryName;
    title = `${input.categoryName} — Forex Marketplace`;
    description = `Browse ${input.categoryName} products for MetaTrader 4 and MetaTrader 5 on FX Bot Hub.`;
  }

  if (input.page && input.page > 1) {
    title = `${title} — Page ${input.page}`;
  }

  return { title, heading, description, canonicalPath, noindex };
}

/** The platform × type landing views worth listing in the sitemap (when they have products). */
export const SITEMAP_LANDING_COMBOS: ReadonlyArray<{ platform?: LandingPlatform; type: LandingType }> = [
  { platform: "MT4", type: "EA" },
  { platform: "MT5", type: "EA" },
  { platform: "MT4", type: "INDICATOR" },
  { platform: "MT5", type: "INDICATOR" },
  { type: "EA" },
  { type: "INDICATOR" },
  { type: "SIGNAL" },
  { type: "TOOL" },
];
