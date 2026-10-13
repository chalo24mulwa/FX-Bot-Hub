import type { Guide, GuideCategorySlug } from "./types";
import { GUIDE_CATEGORIES } from "./types";
import { forexTradingForBeginners } from "./articles/getting-started";
import { howToInstallMt4, howToInstallMt5 } from "./articles/metatrader";
import { whatIsAnExpertAdvisor, howToInstallEaMt4, howToInstallEaMt5, howToEvaluateATradingBot } from "./articles/expert-advisors";
import { howToInstallIndicator, howToBacktestAnEa, riskManagement } from "./articles/indicators-backtesting-risk";
import { eaTroubleshooting, howToBuyOnFxBotHub, sellersGuide } from "./articles/troubleshooting-and-fxbothub";

/** Every published guide. Order here is the default "browse" order on /guides. */
export const GUIDES: Guide[] = [
  forexTradingForBeginners,
  howToInstallMt4,
  howToInstallMt5,
  whatIsAnExpertAdvisor,
  howToInstallEaMt4,
  howToInstallEaMt5,
  howToInstallIndicator,
  howToBacktestAnEa,
  howToEvaluateATradingBot,
  riskManagement,
  eaTroubleshooting,
  howToBuyOnFxBotHub,
  sellersGuide,
];

/** The guide promoted on the landing page for newcomers. */
export const FEATURED_GUIDE_SLUG = "forex-trading-for-beginners";

export function getGuide(slug: string): Guide | undefined {
  return GUIDES.find((g) => g.slug === slug);
}

export function getCategory(slug: GuideCategorySlug) {
  return GUIDE_CATEGORIES.find((c) => c.slug === slug)!;
}

/** Categories that actually have guides — empty categories are never shown. */
export function categoriesWithGuides() {
  return GUIDE_CATEGORIES.map((c) => ({ ...c, count: GUIDES.filter((g) => g.category === c.slug).length })).filter(
    (c) => c.count > 0,
  );
}

/** Related guides: the explicit list first, then same-category guides, never the guide itself. */
export function relatedGuides(guide: Guide, limit = 3): Guide[] {
  const picked: Guide[] = [];
  for (const slug of guide.related) {
    const g = getGuide(slug);
    if (g && g.slug !== guide.slug && !picked.includes(g)) picked.push(g);
  }
  for (const g of GUIDES) {
    if (picked.length >= limit) break;
    if (g.category === guide.category && g.slug !== guide.slug && !picked.includes(g)) picked.push(g);
  }
  return picked.slice(0, limit);
}
