import type { GuideBlock } from "@/content/guides/types";

/**
 * Tutorial content model. Tutorials are hands-on, numbered procedures ("do this, then
 * this"); Guides (src/content/guides) explain concepts ("what is this, why does it
 * matter"). Both are typed content files in the repo — there is no CMS to extend, file
 * content needs no migration, and it ships with each deploy. To add a tutorial, create a
 * file in ./articles and register it in ./index.ts: the hub, search, filters, prev/next
 * navigation and the sitemap pick it up automatically.
 *
 * Inline text uses the same tiny markup as guides (src/lib/guides/inline.ts): **bold**,
 * `code` and [label](/internal or https://external). It renders as React elements only.
 */

export const TUTORIAL_CATEGORIES = [
  { slug: "getting-started", name: "Getting Started", description: "First steps: choosing between MT4 and MT5 and getting a platform ready to use." },
  { slug: "mt4", name: "MetaTrader 4", description: "Installing MT4, adding tools to it and reading its logs." },
  { slug: "mt5", name: "MetaTrader 5", description: "Installing MT5 and running Expert Advisors with Algo Trading." },
  { slug: "expert-advisors", name: "Forex Bots & EAs", description: "Configuring Expert Advisors and fixing an EA that won't trade." },
  { slug: "indicators", name: "Indicators", description: "Installing custom indicators in MT4 and MT5 and adjusting their settings." },
  { slug: "testing-risk", name: "Testing & Risk", description: "Backtesting in the Strategy Tester and demo-testing a bot before real money." },
  { slug: "fxbothub", name: "FXBotHub Marketplace", description: "Evaluating listings and getting your files and license keys on FXBotHub." },
] as const;

export type TutorialCategorySlug = (typeof TUTORIAL_CATEGORIES)[number]["slug"];

export const DIFFICULTIES = [
  { slug: "beginner", name: "Beginner" },
  { slug: "intermediate", name: "Intermediate" },
  { slug: "advanced", name: "Advanced" },
] as const;

export type Difficulty = (typeof DIFFICULTIES)[number]["slug"];

export interface TutorialStep {
  title: string;
  /** One or more paragraphs (inline markup allowed). */
  text: string[];
  /** Optional sub-points rendered as a list under the paragraphs. */
  items?: string[];
  /** Optional note or warning attached to this step. */
  note?: { tone: "info" | "warning"; text: string };
}

export interface Tutorial {
  /** Permanent URL slug: /tutorials/<slug>. Never change it once published. */
  slug: string;
  title: string;
  /** Meta title (the " | FX Bot Hub" suffix is added by the layout template). */
  seoTitle: string;
  /** Meta description and card summary — unique, at most 160 characters. */
  description: string;
  category: TutorialCategorySlug;
  difficulty: Difficulty;
  /** Rough time to complete, in minutes. Always shown labelled as an estimate. */
  estimatedMinutes: number;
  /** ISO dates (YYYY-MM-DD). Bump `updated` whenever the steps meaningfully change. */
  published: string;
  updated: string;
  /** One or two sentences under the H1: what you'll do. */
  intro: string;
  requirements: string[];
  outcomes: string[];
  steps: TutorialStep[];
  /** Optional reference material shown after the steps (tables, comparisons). */
  reference?: { heading: string; blocks: GuideBlock[] };
  /** What the reader should see once every step is done. */
  expectedResult: string;
  troubleshooting: { problem: string; fix: string }[];
  /** Related tutorials (slugs). */
  related: string[];
  /** Concept guides that explain the background (guide slugs). */
  guides: string[];
  /** The recommended next tutorial (slug). */
  next?: string;
  /** Marketplace (or other on-site) links relevant to this tutorial. */
  links: { label: string; href: string }[];
  /** Official documentation this tutorial relies on. */
  sources?: { label: string; url: string }[];
  /** Show the trading-risk disclaimer (anything involving live trading or bots). */
  riskDisclaimer: boolean;
}
