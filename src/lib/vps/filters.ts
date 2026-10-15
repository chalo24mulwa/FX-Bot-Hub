import { slugify } from "@/lib/brokers/validation";

// Public-page filters for /vps. Pure and data-driven: a filter exists only when at least one published
// provider actually matches it, so the page never offers one the data can't back up. "Budget-friendly" is
// the admin's own category tag (we don't invent a price threshold).

export interface FilterableVps {
  bestFor: readonly string[];
  platforms: readonly string[];
  operatingSystems: readonly string[];
  serverLocations: readonly string[];
  freeTrial: boolean;
}

export interface VpsFilter {
  key: string;
  label: string;
  count: number;
}

export const MT_FILTER = "mt4-mt5";
export const WINDOWS_FILTER = "windows";
export const TRIAL_FILTER = "free-trial";
export const REGION_PREFIX = "region-";
const RESERVED = new Set([MT_FILTER, WINDOWS_FILTER, TRIAL_FILTER]);
const MAX_REGION_FILTERS = 6;

/** Friendlier labels for the built-in "best for" categories; any other category uses its own text. */
const TAG_LABELS: Record<string, string> = {
  beginners: "Best for beginners",
  "multiple-eas": "Multiple EA instances",
  "low-latency-trading": "Low-latency trading",
  "budget-friendly": "Budget-friendly options",
};

const isMt = (p: FilterableVps) => p.platforms.some((x) => /^mt[45]$/i.test(x.trim())) || p.bestFor.some((t) => slugify(t) === "mt4-mt5-users");
const isWindows = (p: FilterableVps) => p.operatingSystems.some((os) => /windows/i.test(os));

function matches(p: FilterableVps, key: string): boolean {
  if (key === MT_FILTER) return isMt(p);
  if (key === WINDOWS_FILTER) return isWindows(p);
  if (key === TRIAL_FILTER) return p.freeTrial;
  if (key.startsWith(REGION_PREFIX)) return p.serverLocations.some((l) => slugify(l) === key.slice(REGION_PREFIX.length));
  return p.bestFor.some((tag) => slugify(tag) === key);
}

export function buildVpsFilters(providers: readonly FilterableVps[]): VpsFilter[] {
  const filters: VpsFilter[] = [];
  const push = (key: string, label: string) => {
    const count = providers.filter((p) => matches(p, key)).length;
    if (count > 0) filters.push({ key, label, count });
  };
  push(MT_FILTER, "MT4/MT5");
  push(WINDOWS_FILTER, "Windows VPS");
  push(TRIAL_FILTER, "Verified free trial");

  // "Best for" categories in use: built-ins in a fixed order, then the admin's own. "MT4/MT5 users" is the
  // MT filter above, so it isn't repeated.
  const labelByKey = new Map<string, string>();
  for (const p of providers) {
    for (const tag of p.bestFor) {
      const key = slugify(tag);
      if (key && key !== "mt4-mt5-users" && !RESERVED.has(key) && !labelByKey.has(key)) labelByKey.set(key, TAG_LABELS[key] ?? tag);
    }
  }
  const builtIn = Object.keys(TAG_LABELS);
  const keys = [...labelByKey.keys()].sort((a, b) => {
    const ia = builtIn.indexOf(a);
    const ib = builtIn.indexOf(b);
    if (ia >= 0 || ib >= 0) return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
    return a.localeCompare(b);
  });
  for (const key of keys) push(key, labelByKey.get(key)!);

  // Server regions: the most common first (ties alphabetical), capped so the bar stays readable.
  const regionCounts = new Map<string, { label: string; count: number }>();
  for (const p of providers) {
    for (const loc of new Set(p.serverLocations.map((l) => l.trim()).filter(Boolean))) {
      const key = slugify(loc);
      if (!key) continue;
      const entry = regionCounts.get(key) ?? { label: loc, count: 0 };
      entry.count += 1;
      regionCounts.set(key, entry);
    }
  }
  [...regionCounts.entries()]
    .sort((a, b) => b[1].count - a[1].count || a[1].label.localeCompare(b[1].label))
    .slice(0, MAX_REGION_FILTERS)
    .forEach(([key, v]) => filters.push({ key: `${REGION_PREFIX}${key}`, label: `Servers in ${v.label}`, count: v.count }));
  return filters;
}

/** The matching providers, or all of them for an unknown/empty key. */
export function applyVpsFilter<T extends FilterableVps>(providers: readonly T[], key: string | undefined): T[] {
  if (!key) return [...providers];
  const known = RESERVED.has(key) || providers.some((p) => matches(p, key));
  return known ? providers.filter((p) => matches(p, key)) : [...providers];
}
