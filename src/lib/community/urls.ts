// Feed URL building (pure). Keeps the current filters when one changes and
// resets pagination.
export type FeedParams = {
  sort?: string;
  type?: string;
  category?: string[];
  q?: string;
  tag?: string;
  instrument?: string;
  page?: number;
};

export function feedHref(base: string, current: FeedParams, overrides: Partial<FeedParams> = {}): string {
  const merged: FeedParams = { ...current, page: undefined, ...overrides };
  const params = new URLSearchParams();
  if (merged.sort && merged.sort !== "latest") params.set("sort", merged.sort);
  if (merged.type) params.set("type", merged.type);
  for (const c of merged.category ?? []) params.append("category", c);
  if (merged.q) params.set("q", merged.q);
  if (merged.tag) params.set("tag", merged.tag);
  if (merged.instrument) params.set("instrument", merged.instrument);
  if (merged.page && merged.page > 1) params.set("page", String(merged.page));
  const qs = params.toString();
  return qs ? `${base}?${qs}` : base;
}

const SORTS = ["latest", "trending", "discussed", "liked"] as const;
const TYPES = ["DISCUSSION", "TRADING_IDEA", "SIGNAL", "QUESTION", "CHART"] as const;
const SLUG = /^[a-z0-9][a-z0-9-]{0,39}$/;

type Raw = { [key: string]: string | string[] | undefined };
const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

/** Untrusted query string -> validated feed params (unknown values are dropped, never passed on). */
export function parseFeedParams(raw: Raw): FeedParams & { sort: string } {
  const sort = first(raw.sort);
  const type = first(raw.type);
  const category = ([] as string[]).concat(raw.category ?? []).filter((c) => SLUG.test(c)).slice(0, 5);
  const page = Number.parseInt(first(raw.page) ?? "1", 10);
  const q = first(raw.q)?.trim().slice(0, 80);
  const tag = first(raw.tag)?.trim().toLowerCase().replace(/^#/, "");
  const instrument = first(raw.instrument)?.trim().slice(0, 20);
  return {
    sort: (SORTS as readonly string[]).includes(sort ?? "") ? (sort as string) : "latest",
    type: (TYPES as readonly string[]).includes(type ?? "") ? type : undefined,
    category: category.length ? category : undefined,
    q: q || undefined,
    tag: tag && /^[a-z0-9][a-z0-9_-]{1,23}$/.test(tag) ? tag : undefined,
    instrument: instrument || undefined,
    page: Number.isFinite(page) && page > 0 ? Math.min(page, 500) : 1,
  };
}
