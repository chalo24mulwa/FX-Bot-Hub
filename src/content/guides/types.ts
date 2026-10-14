/**
 * Guide content model. Guides explain concepts and background; numbered how-to
 * procedures are Tutorials (src/content/tutorials), which guides link to via `tutorials`.
 *
 * Guides are typed content files in the repo (no database table):
 * there was no CMS to extend, and file-based content needs no migration, is reviewed in
 * pull requests and ships with each deploy. To add a guide, create a file in ./articles,
 * register it in ./index.ts, and it is picked up by /guides, search, the sitemap and
 * related-guide links automatically.
 *
 * Inline text supports a deliberately tiny markup (see src/lib/guides/inline.ts):
 * **bold**, `code` and [label](/internal-path or https://external). Nothing else is
 * interpreted, and it renders as React elements — never as HTML strings.
 */

export const GUIDE_CATEGORIES = [
  { slug: "getting-started", name: "Getting Started", description: "Forex basics: currency pairs, pips, spreads, lots and the terms you'll meet everywhere." },
  { slug: "expert-advisors", name: "Expert Advisors & Forex Bots", description: "What EAs are, how they work, and how to judge one before you rely on it." },
  { slug: "risk-management", name: "Risk Management", description: "Position sizing, stop-losses, leverage and drawdown." },
  { slug: "fxbothub", name: "Selling on FXBotHub", description: "Publishing and selling your own trading tools on FXBotHub." },
  { slug: "troubleshooting", name: "Troubleshooting", description: "A reference to common MT4/MT5 and EA errors and what causes them." },
] as const;

export type GuideCategorySlug = (typeof GUIDE_CATEGORIES)[number]["slug"];

export type GuideBlock =
  | { type: "h2"; text: string }
  | { type: "h3"; text: string }
  | { type: "p"; text: string }
  | { type: "ul"; items: string[] }
  | { type: "ol"; items: string[] }
  | { type: "steps"; items: { title: string; text: string }[] }
  | { type: "callout"; tone: "info" | "warning"; title?: string; text: string }
  | { type: "table"; caption: string; headers: string[]; rows: string[][] };

export interface GuideCta {
  label: string;
  href: string;
  text: string;
}

export interface Guide {
  /** Permanent URL slug: /guides/<slug>. Never change it once published. */
  slug: string;
  title: string;
  /** Meta title (the " | FX Bot Hub" suffix is added by the layout template). */
  seoTitle: string;
  /** Meta description and card summary — unique per guide. */
  description: string;
  category: GuideCategorySlug;
  /** ISO dates (YYYY-MM-DD). Bump `updated` whenever the content meaningfully changes. */
  published: string;
  updated: string;
  /** Short "what you'll learn" intro shown under the H1. */
  intro: string;
  blocks: GuideBlock[];
  related: string[];
  /** Hands-on tutorials (slugs in src/content/tutorials) that put this guide into practice. */
  tutorials: string[];
  cta?: GuideCta;
  /** Show the trading-risk disclaimer (anything discussing markets or automated trading). */
  riskDisclaimer: boolean;
}
