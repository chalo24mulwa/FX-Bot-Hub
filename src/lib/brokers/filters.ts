import { slugify } from "./validation";

// Public-page filters for /best-brokers. Pure and data-driven: a filter only exists when at least one
// published broker actually matches it, so the page never offers a filter the data can't back up.

export interface FilterableBroker {
  bestFor: readonly string[];
  platforms: readonly string[];
  regulation: string | null;
}

export interface BrokerFilter {
  key: string;
  label: string;
  count: number;
}

export const MT_FILTER = "mt4-mt5";
export const REGULATED_FILTER = "regulated";
const RESERVED = new Set([MT_FILTER, REGULATED_FILTER]);

/** Friendlier labels for the built-in "best for" categories; any other category uses its own text. */
const TAG_LABELS: Record<string, string> = {
  beginners: "Best for beginners",
  "algorithmic-trading": "Algorithmic trading",
  "low-spread-trading": "Low-spread brokers",
  "experienced-traders": "Experienced traders",
};

const isMt = (b: FilterableBroker) => b.platforms.some((p) => /^mt[45]$/i.test(p.trim()));
const isRegulated = (b: FilterableBroker) => Boolean(b.regulation && b.regulation.trim());

function matches(b: FilterableBroker, key: string): boolean {
  if (key === MT_FILTER) return isMt(b);
  if (key === REGULATED_FILTER) return isRegulated(b);
  return b.bestFor.some((tag) => slugify(tag) === key);
}

export function buildFilters(brokers: readonly FilterableBroker[]): BrokerFilter[] {
  const filters: BrokerFilter[] = [];
  const mt = brokers.filter(isMt).length;
  if (mt > 0) filters.push({ key: MT_FILTER, label: "MT4/MT5 traders", count: mt });
  const regulated = brokers.filter(isRegulated).length;
  if (regulated > 0) filters.push({ key: REGULATED_FILTER, label: "Regulated brokers", count: regulated });

  // One filter per "best for" category in use, built-ins first (in a fixed order), then the admin's own.
  const labelByKey = new Map<string, string>();
  for (const b of brokers) {
    for (const tag of b.bestFor) {
      const key = slugify(tag);
      if (key && !RESERVED.has(key) && !labelByKey.has(key)) labelByKey.set(key, TAG_LABELS[key] ?? tag);
    }
  }
  const builtInOrder = Object.keys(TAG_LABELS);
  const keys = [...labelByKey.keys()].sort((a, b) => {
    const ia = builtInOrder.indexOf(a);
    const ib = builtInOrder.indexOf(b);
    if (ia >= 0 || ib >= 0) return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
    return a.localeCompare(b);
  });
  for (const key of keys) {
    const count = brokers.filter((b) => matches(b, key)).length;
    if (count > 0) filters.push({ key, label: labelByKey.get(key)!, count });
  }
  return filters;
}

/** Returns the matching brokers, or all of them for an unknown/empty key. */
export function applyFilter<T extends FilterableBroker>(brokers: readonly T[], key: string | undefined): T[] {
  if (!key || (!RESERVED.has(key) && !brokers.some((b) => matches(b, key)))) return [...brokers];
  return brokers.filter((b) => matches(b, key));
}
