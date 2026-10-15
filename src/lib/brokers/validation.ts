import { z } from "zod";

// Pure validation/normalisation for the Best Brokers admin form. No database or env access, so it
// is unit-tested directly (validation.test.ts). Everything an administrator types passes through
// `brokerInputSchema` before it can be stored or shown.

/** Categories the admin form offers as ticks. Anyone can also type their own ("other categories"). */
export const BEST_FOR_PRESETS = ["Beginners", "Algorithmic trading", "Experienced traders", "Low-spread trading"] as const;
export const PLATFORM_PRESETS = ["MT4", "MT5", "cTrader", "TradingView", "Web platform", "Mobile app"] as const;

export const LIMITS = {
  name: 80,
  tagline: 160,
  feature: 160,
  features: 8,
  why: 800,
  tag: 40,
  bestFor: 6,
  platform: 30,
  platforms: 8,
  short: 120,
  medium: 400,
  regulation: 600,
  ratingNote: 300,
  url: 500,
} as const;

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

const IPV4 = /^\d{1,3}(\.\d{1,3}){3}$/;

export type UrlCheck = { ok: true; url: string } | { ok: false; error: string };

/**
 * A broker link must be a plain https URL to a public hostname. Rejects `javascript:`/`data:` and every
 * other scheme, embedded credentials, `localhost`/internal names and IP literals (which would turn a
 * "Visit broker" button into a way to point visitors at someone's network), and absurd lengths.
 */
export function parseExternalUrl(raw: string): UrlCheck {
  const value = raw.trim();
  if (!value) return { ok: false, error: "Enter a web address." };
  if (value.length > LIMITS.url) return { ok: false, error: `Web addresses can be at most ${LIMITS.url} characters.` };
  if (/[\s\u0000-\u001f\u007f]/.test(value)) return { ok: false, error: "A web address can't contain spaces or control characters." };
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    return { ok: false, error: "That doesn't look like a valid web address (include https://)." };
  }
  if (parsed.protocol !== "https:") return { ok: false, error: "Only https:// web addresses are allowed." };
  if (parsed.username || parsed.password) return { ok: false, error: "A web address can't include a username or password." };
  const host = parsed.hostname.toLowerCase();
  if (!host.includes(".") || host.endsWith(".") || host === "localhost" || /\.(local|localhost|internal|lan|home|test)$/.test(host)) {
    return { ok: false, error: "Use the broker's public website address." };
  }
  if (IPV4.test(host) || host.startsWith("[")) return { ok: false, error: "Use the broker's website name, not an IP address." };
  return { ok: true, url: parsed.href };
}

/** Splits free text on newlines/commas, trims, drops blanks and case-insensitive duplicates. */
export function splitList(raw: string, separators: RegExp = /[\n,]+/): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const part of raw.split(separators)) {
    const item = part.trim().replace(/\s+/g, " ");
    const key = item.toLowerCase();
    if (!item || seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

/** Re-cases a typed tag to the preset it matches ("beginners" -> "Beginners"). */
export function canonicalTag(tag: string, presets: readonly string[]): string {
  return presets.find((p) => p.toLowerCase() === tag.toLowerCase()) ?? tag;
}

const optionalText = (max: number, label: string) =>
  z
    .string()
    .trim()
    .max(max, `${label} can be at most ${max} characters.`)
    .transform((v) => (v === "" ? null : v));

const tagList = (presets: readonly string[], maxItems: number, maxLen: number, label: string) =>
  z
    .array(z.string())
    .transform((items) => splitList(items.join("\n")).map((t) => canonicalTag(t, presets)))
    .refine((items) => items.length <= maxItems, `Choose at most ${maxItems} ${label}.`)
    .refine((items) => items.every((t) => t.length <= maxLen), `Each of the ${label} can be at most ${maxLen} characters.`);

function todayIso(now = new Date()): string {
  return now.toISOString().slice(0, 10);
}

export const brokerInputSchema = z.object({
  name: z.string().trim().min(2, "Enter the broker's name (at least 2 characters).").max(LIMITS.name, `The name can be at most ${LIMITS.name} characters.`),
  tagline: optionalText(LIMITS.tagline, "The tagline"),
  officialUrl: z
    .string()
    .transform((v, ctx) => {
      const r = parseExternalUrl(v);
      if (!r.ok) {
        ctx.addIssue({ code: "custom", message: `Official website: ${r.error}` });
        return z.NEVER;
      }
      return r.url;
    }),
  affiliateUrl: z
    .string()
    .transform((v, ctx) => {
      if (!v.trim()) return null;
      const r = parseExternalUrl(v);
      if (!r.ok) {
        ctx.addIssue({ code: "custom", message: `Affiliate / referral link: ${r.error}` });
        return z.NEVER;
      }
      return r.url;
    }),
  sponsored: z.boolean(),
  featured: z.boolean(),
  features: z
    .array(z.string())
    .transform((items) => splitList(items.join("\n"), /\n+/))
    .refine((items) => items.length <= LIMITS.features, `Add at most ${LIMITS.features} key features.`)
    .refine((items) => items.every((f) => f.length <= LIMITS.feature), `Each feature can be at most ${LIMITS.feature} characters.`),
  whySelected: z.string().trim().max(LIMITS.why, `"Why we selected this broker" can be at most ${LIMITS.why} characters.`),
  bestFor: tagList(BEST_FOR_PRESETS, LIMITS.bestFor, LIMITS.tag, "categories"),
  platforms: tagList(PLATFORM_PRESETS, LIMITS.platforms, LIMITS.platform, "platforms"),
  instruments: optionalText(LIMITS.medium, "Instruments"),
  accountTypes: optionalText(LIMITS.medium, "Account types"),
  minDeposit: optionalText(LIMITS.short, "Minimum deposit"),
  spreadsInfo: optionalText(LIMITS.medium, "Spreads and costs"),
  regulation: optionalText(LIMITS.regulation, "Regulation"),
  rating: z
    .union([z.number(), z.null()])
    .refine((v) => v === null || (Number.isFinite(v) && v >= 0 && v <= 5), "The rating must be between 0 and 5.")
    .refine((v) => v === null || Math.abs(v * 10 - Math.round(v * 10)) < 1e-9, "Use one decimal place for the rating (for example 4.5)."),
  ratingNote: optionalText(LIMITS.ratingNote, "The rating note"),
  infoVerifiedAt: z
    .union([z.string(), z.null()])
    .transform((v, ctx) => {
      if (v === null || !v.trim()) return null;
      const d = v.trim();
      if (!/^\d{4}-\d{2}-\d{2}$/.test(d) || Number.isNaN(Date.parse(`${d}T00:00:00Z`)) || new Date(`${d}T00:00:00Z`).toISOString().slice(0, 10) !== d) {
        ctx.addIssue({ code: "custom", message: "Enter the verification date as YYYY-MM-DD." });
        return z.NEVER;
      }
      if (d > todayIso()) {
        ctx.addIssue({ code: "custom", message: "The verification date can't be in the future." });
        return z.NEVER;
      }
      return d;
    }),
  position: z.union([z.number().int("The position must be a whole number."), z.null()]).refine((v) => v === null || (v >= 1 && v <= 500), "The position must be between 1 and 500."),
});

export type BrokerInput = z.infer<typeof brokerInputSchema>;

/** Facts a visitor would rely on; if any is shown, the page must say when it was checked. */
const FACT_KEYS = ["regulation", "platforms", "instruments", "accountTypes", "minDeposit", "spreadsInfo", "rating"] as const;

export interface PublishCheckInput {
  officialUrl: string;
  whySelected: string;
  features: readonly string[];
  regulation: string | null;
  platforms: readonly string[];
  instruments: string | null;
  accountTypes: string | null;
  minDeposit: string | null;
  spreadsInfo: string | null;
  rating: number | null;
  infoVerifiedAt: Date | string | null;
}

/** What must be fixed before a broker may go public. Empty means it can be published. */
export function publishBlockers(b: PublishCheckInput): string[] {
  const problems: string[] = [];
  if (!b.officialUrl) problems.push("Add the broker's official website.");
  if (!b.whySelected.trim()) problems.push('Write "Why we selected this broker".');
  if (b.features.length === 0) problems.push("Add at least one key feature.");
  const hasFacts = FACT_KEYS.some((key) => {
    const v = b[key];
    return Array.isArray(v) ? v.length > 0 : v !== null && v !== "";
  });
  if (hasFacts && !b.infoVerifiedAt) problems.push("Add the date the broker information was verified — the page shows it next to the facts.");
  return problems;
}

/** The ordered ids with `id` moved to 1-based `position` (clamped); other brokers keep their relative order. */
export function placeAt(ids: readonly string[], id: string, position: number): string[] {
  if (!ids.includes(id)) return [...ids];
  const without = ids.filter((x) => x !== id);
  const index = Math.min(Math.max(Math.trunc(position) - 1, 0), without.length);
  return [...without.slice(0, index), id, ...without.slice(index)];
}

/** Moves one place up (-1) or down (+1); at either end it stays put. */
export function moveBy(ids: readonly string[], id: string, delta: -1 | 1): string[] {
  const index = ids.indexOf(id);
  if (index < 0) return [...ids];
  const target = index + delta;
  if (target < 0 || target >= ids.length) return [...ids];
  const next = [...ids];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}

export function formatRating(rating: number): string {
  return rating.toFixed(1);
}

/** `YYYY-MM-DD` for display, from a Date or already-formatted string. */
export function isoDay(value: Date | string): string {
  return (typeof value === "string" ? new Date(value) : value).toISOString().slice(0, 10);
}

/**
 * Rebuilds the full ordering after a change inside one group (for example only the published brokers):
 * the group's members take the new order, but keep occupying the slots the group already held, so brokers
 * outside the group never move. `newGroupOrder` must be a permutation of the group's members.
 */
export function reorderWithin(all: readonly string[], group: ReadonlySet<string>, newGroupOrder: readonly string[]): string[] {
  const queue = [...newGroupOrder];
  return all.map((id) => (group.has(id) ? (queue.shift() ?? id) : id));
}
