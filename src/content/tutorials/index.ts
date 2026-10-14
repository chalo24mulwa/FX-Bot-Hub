import type { Tutorial, TutorialCategorySlug, Difficulty } from "./types";
import { DIFFICULTIES, TUTORIAL_CATEGORIES } from "./types";
import { installMetatrader5, installMetatrader4, compareMt4Mt5Tools } from "./articles/platform-setup";
import { installEaMt5, installEaMt4, configureEaSettings, readMt4Logs, troubleshootEaNotTrading } from "./articles/expert-advisors";
import { installIndicatorMt5, installIndicatorMt4 } from "./articles/indicators";
import { backtestEaMt5, testBotOnDemo } from "./articles/testing";
import { evaluateBotBeforeBuying, findTradingToolsOnFxBotHub } from "./articles/fxbothub";

/**
 * Every published tutorial, in learning-path order. This order drives the default
 * ("relevance", no query) listing on /tutorials and the Previous/Next links on each page.
 */
export const TUTORIALS: Tutorial[] = [
  installMetatrader5,
  installMetatrader4,
  installEaMt5,
  installEaMt4,
  installIndicatorMt5,
  installIndicatorMt4,
  configureEaSettings,
  backtestEaMt5,
  readMt4Logs,
  troubleshootEaNotTrading,
  testBotOnDemo,
  evaluateBotBeforeBuying,
  compareMt4Mt5Tools,
  findTradingToolsOnFxBotHub,
];

/** Promoted in the hub's hero and the target of "Start Learning". */
export const FEATURED_TUTORIAL_SLUG = "install-metatrader-5";

export function getTutorial(slug: string): Tutorial | undefined {
  return TUTORIALS.find((t) => t.slug === slug);
}

export function getTutorialCategory(slug: TutorialCategorySlug) {
  return TUTORIAL_CATEGORIES.find((c) => c.slug === slug)!;
}

export function difficultyName(slug: Difficulty): string {
  return DIFFICULTIES.find((d) => d.slug === slug)!.name;
}

/** Categories that have tutorials — empty categories are never shown. */
export function tutorialCategoriesWithCounts() {
  return TUTORIAL_CATEGORIES.map((c) => ({ ...c, count: TUTORIALS.filter((t) => t.category === c.slug).length })).filter(
    (c) => c.count > 0,
  );
}

/** Previous / next in learning-path order. */
export function adjacentTutorials(slug: string): { previous?: Tutorial; next?: Tutorial } {
  const i = TUTORIALS.findIndex((t) => t.slug === slug);
  if (i < 0) return {};
  return { previous: TUTORIALS[i - 1], next: TUTORIALS[i + 1] };
}

/** Related tutorials: the explicit list first, then same-category ones, never itself. */
export function relatedTutorials(tutorial: Tutorial, limit = 3): Tutorial[] {
  const picked: Tutorial[] = [];
  const add = (t?: Tutorial) => {
    if (t && t.slug !== tutorial.slug && !picked.includes(t)) picked.push(t);
  };
  tutorial.related.forEach((s) => add(getTutorial(s)));
  for (const t of TUTORIALS) {
    if (picked.length >= limit) break;
    if (t.category === tutorial.category) add(t);
  }
  return picked.slice(0, limit);
}

export { MOVED_FROM_GUIDES } from "./moved-guides";
