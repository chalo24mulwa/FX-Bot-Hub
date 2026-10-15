import { z } from "zod";
import { canonicalTag, parseExternalUrl, splitList } from "@/lib/brokers/validation";

// Pure validation/normalisation for the VPS provider admin form. No database or env access, so it is
// unit-tested directly (vps.test.ts). It reuses the generic, already-tested URL/list helpers from the
// broker feature — but the data models stay separate.

export const BEST_FOR_PRESETS = ["Beginners", "MT4/MT5 users", "Low-latency trading", "Multiple EAs", "Budget-friendly"] as const;
export const OS_PRESETS = ["Windows Server", "Windows 10/11", "Linux"] as const;
export const PLATFORM_PRESETS = ["MT4", "MT5", "cTrader", "TradingView", "Other trading apps"] as const;
export const CTA_LABELS = ["Visit Provider", "Get VPS", "View Plans"] as const;
export const PRICE_PERIODS = ["MONTH", "YEAR"] as const;
export type PricePeriod = (typeof PRICE_PERIODS)[number];

export const LIMITS = {
  name: 80,
  category: 60,
  headline: 160,
  description: 2000,
  feature: 160,
  features: 8,
  advantages: 8,
  limitations: 5,
  why: 800,
  tag: 40,
  bestFor: 6,
  os: 40,
  oses: 6,
  location: 40,
  locations: 20,
  platform: 30,
  platforms: 8,
  spec: 120,
  longSpec: 400,
  trial: 240,
  offer: 240,
  promo: 40,
  disclosure: 160,
  ratingNote: 300,
  latencySource: 300,
  seoTitle: 70,
  seoDescription: 160,
} as const;

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

const lineList = (max: number, maxLen: number, label: string) =>
  z
    .array(z.string())
    .transform((items) => splitList(items.join("\n"), /\n+/))
    .refine((items) => items.length <= max, `Add at most ${max} ${label}.`)
    .refine((items) => items.every((f) => f.length <= maxLen), `Each of the ${label} can be at most ${maxLen} characters.`);

function todayIso(now = new Date()): string {
  return now.toISOString().slice(0, 10);
}

/** `YYYY-MM-DD` that is a real calendar date. */
export function isRealDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;
}

const optionalUrl = (label: string) =>
  z.string().transform((v, ctx) => {
    if (!v.trim()) return null;
    const r = parseExternalUrl(v);
    if (!r.ok) {
      ctx.addIssue({ code: "custom", message: `${label}: ${r.error}` });
      return z.NEVER;
    }
    return r.url;
  });

/** "9.99" -> 999. Whole or two-decimal amounts only; empty -> null. */
export function parsePriceToCents(raw: string): number | null | "invalid" {
  const v = raw.trim();
  if (v === "") return null;
  if (!/^\d{1,6}(\.\d{1,2})?$/.test(v)) return "invalid";
  const cents = Math.round(Number(v) * 100);
  return cents > 0 ? cents : "invalid";
}

export const vpsInputSchema = z
  .object({
    name: z.string().trim().min(2, "Enter the provider's name (at least 2 characters).").max(LIMITS.name, `The name can be at most ${LIMITS.name} characters.`),
    category: optionalText(LIMITS.category, "The category"),
    headline: optionalText(LIMITS.headline, "The short description"),
    description: z.string().trim().max(LIMITS.description, `The full description can be at most ${LIMITS.description} characters.`),
    officialUrl: z.string().transform((v, ctx) => {
      const r = parseExternalUrl(v);
      if (!r.ok) {
        ctx.addIssue({ code: "custom", message: `Official website: ${r.error}` });
        return z.NEVER;
      }
      return r.url;
    }),
    affiliateUrl: optionalUrl("Affiliate / referral link"),
    ctaLabel: z
      .string()
      .trim()
      .refine((v) => v === "" || (CTA_LABELS as readonly string[]).includes(v), "Pick a button text from the list.")
      .transform((v) => (v === "" ? null : v)),
    promoCode: z
      .string()
      .trim()
      .refine((v) => v === "" || /^[A-Za-z0-9_-]{2,40}$/.test(v), "A promotional code can only use letters, numbers, hyphens and underscores (2-40 characters).")
      .transform((v) => (v === "" ? null : v)),
    offerText: optionalText(LIMITS.offer, "The offer description"),
    offerExpiresAt: z.string().transform((v, ctx) => {
      const d = v.trim();
      if (!d) return null;
      if (!isRealDate(d)) {
        ctx.addIssue({ code: "custom", message: "Enter the offer expiry date as YYYY-MM-DD." });
        return z.NEVER;
      }
      return d;
    }),
    sponsored: z.boolean(),
    disclosureNote: optionalText(LIMITS.disclosure, "The disclosure label"),
    featured: z.boolean(),
    features: lineList(LIMITS.features, LIMITS.feature, "main features"),
    advantages: lineList(LIMITS.advantages, LIMITS.feature, "key advantages"),
    limitations: lineList(LIMITS.limitations, LIMITS.feature, "limitations"),
    whyRecommend: z.string().trim().max(LIMITS.why, `"Why we recommend this provider" can be at most ${LIMITS.why} characters.`),
    bestFor: tagList(BEST_FOR_PRESETS, LIMITS.bestFor, LIMITS.tag, "best-for categories"),
    operatingSystems: tagList(OS_PRESETS, LIMITS.oses, LIMITS.os, "operating systems"),
    serverLocations: tagList([], LIMITS.locations, LIMITS.location, "server locations"),
    platforms: tagList(PLATFORM_PRESETS, LIMITS.platforms, LIMITS.platform, "trading platforms"),
    cpu: optionalText(LIMITS.spec, "CPU"),
    ram: optionalText(LIMITS.spec, "RAM"),
    storage: optionalText(LIMITS.spec, "Storage"),
    otherSpecs: optionalText(LIMITS.longSpec, "Other specifications"),
    price: z.string().transform((v, ctx) => {
      const cents = parsePriceToCents(v);
      if (cents === "invalid") {
        ctx.addIssue({ code: "custom", message: "Enter the starting price as a positive amount such as 9.99." });
        return z.NEVER;
      }
      return cents;
    }),
    priceCurrency: z
      .string()
      .trim()
      .toUpperCase()
      .refine((v) => v === "" || /^[A-Z]{3}$/.test(v), "Use a three-letter currency code such as USD.")
      .transform((v) => (v === "" ? null : v)),
    pricePeriod: z
      .string()
      .trim()
      .toUpperCase()
      .refine((v) => v === "" || (PRICE_PERIODS as readonly string[]).includes(v), "Choose monthly or yearly pricing.")
      .transform((v) => (v === "" ? null : (v as PricePeriod))),
    freeTrial: z.boolean(),
    trialNote: optionalText(LIMITS.trial, "The trial or money-back offer"),
    latencyInfo: optionalText(LIMITS.longSpec, "Latency information"),
    latencySource: optionalText(LIMITS.latencySource, "The latency source"),
    rating: z
      .union([z.number(), z.null()])
      .refine((v) => v === null || (Number.isFinite(v) && v >= 0 && v <= 5), "The rating must be between 0 and 5.")
      .refine((v) => v === null || Math.abs(v * 10 - Math.round(v * 10)) < 1e-9, "Use one decimal place for the rating (for example 4.5)."),
    ratingNote: optionalText(LIMITS.ratingNote, "The rating methodology note"),
    seoTitle: optionalText(LIMITS.seoTitle, "The SEO title"),
    seoDescription: optionalText(LIMITS.seoDescription, "The SEO description"),
    infoVerifiedAt: z.union([z.string(), z.null()]).transform((v, ctx) => {
      if (v === null || !v.trim()) return null;
      const d = v.trim();
      if (!isRealDate(d)) {
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
  })
  .superRefine((v, ctx) => {
    // A price is meaningless without its currency and period (and vice versa), so they come as a set.
    const parts = [v.price !== null, v.priceCurrency !== null, v.pricePeriod !== null];
    if (parts.some(Boolean) && !parts.every(Boolean)) {
      ctx.addIssue({ code: "custom", path: ["price"], message: "Enter the price, its currency and whether it is monthly or yearly together — or leave all three blank." });
    }
  });

export type VpsInput = z.infer<typeof vpsInputSchema>;

/** Facts a visitor would rely on; if any is shown, the page must say when it was checked. */
const FACT_KEYS = ["operatingSystems", "serverLocations", "platforms", "cpu", "ram", "storage", "otherSpecs", "priceCents", "trialNote", "latencyInfo", "rating"] as const;

export interface VpsPublishCheck {
  officialUrl: string;
  whyRecommend: string;
  features: readonly string[];
  operatingSystems: readonly string[];
  serverLocations: readonly string[];
  platforms: readonly string[];
  cpu: string | null;
  ram: string | null;
  storage: string | null;
  otherSpecs: string | null;
  priceCents: number | null;
  trialNote: string | null;
  latencyInfo: string | null;
  latencySource: string | null;
  freeTrial: boolean;
  rating: number | null;
  infoVerifiedAt: Date | string | null;
}

/** What must be fixed before a provider may go public. Empty means it can be published. */
export function vpsPublishBlockers(p: VpsPublishCheck): string[] {
  const problems: string[] = [];
  if (!p.officialUrl) problems.push("Add the provider's official website.");
  if (!p.whyRecommend.trim()) problems.push('Write "Why we recommend this provider".');
  if (p.features.length === 0) problems.push("Add at least one main feature.");
  const hasFacts = FACT_KEYS.some((key) => {
    const v = p[key];
    return Array.isArray(v) ? v.length > 0 : v !== null && v !== "";
  }) || p.freeTrial;
  if (hasFacts && !p.infoVerifiedAt) problems.push("Add the date the provider information was verified — the page shows it next to the facts.");
  if (p.latencyInfo && !p.latencySource) problems.push("Latency information needs its source (a test, a published page, or a measurement) before it can be shown.");
  return problems;
}
