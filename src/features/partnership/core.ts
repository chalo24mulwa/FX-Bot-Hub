import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { REFERRAL_COOKIE, RECRUIT_COOKIE, verifyCodeCookie, type SignedCode } from "@/lib/partnership/codes";
import { formatMoney, formatRate } from "@/lib/partnership/rules";
import { DEFAULT_TERMS, fillTerms } from "@/lib/partnership/terms";

/** An expected, user-presentable failure — server actions turn it into `{ ok: false, error }`. */
export class PartnershipError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

export type ActionResult<T = object> = ({ ok: true } & T) | { ok: false; error: string };

export type Tx = Prisma.TransactionClient;

export const SETTINGS_ID = "singleton";

/** Upserts the singleton row on first read, same pattern as MarketplaceSettings. */
export async function getPartnershipSettings() {
  return db.partnershipSettings.upsert({ where: { id: SETTINGS_ID }, update: {}, create: { id: SETTINGS_ID } });
}

export type PartnershipSettingsRow = Awaited<ReturnType<typeof getPartnershipSettings>>;

export function settingsSummary(s: PartnershipSettingsRow) {
  const currency = s.currencies[0] ?? "USD";
  return {
    partnerRate: formatRate(s.partnerRateBps),
    masterRate: formatRate(s.masterRateBps),
    attributionDays: s.attributionDays,
    holdDays: s.holdDays,
    minPayout: formatMoney(s.minPayoutCents, currency),
    referredUserCommissionDays: s.referredUserCommissionDays,
  };
}

export function programmeTerms(s: PartnershipSettingsRow): string {
  return fillTerms(s.termsText?.trim() ? s.termsText : DEFAULT_TERMS, settingsSummary(s));
}

export const cookieSecret = () => env.AUTH_SECRET;

/** Reads and verifies the referral cookie from the current request (never trusts it unsigned). */
export async function readReferralCookie(now: Date, maxAgeDays: number): Promise<SignedCode | null> {
  try {
    const { cookies } = await import("next/headers");
    const store = await cookies();
    return verifyCodeCookie(store.get(REFERRAL_COOKIE)?.value, cookieSecret(), now, maxAgeDays);
  } catch {
    return null; // called outside a request (scripts, jobs)
  }
}

export async function readRecruitCookie(now: Date, maxAgeDays: number): Promise<SignedCode | null> {
  try {
    const { cookies } = await import("next/headers");
    const store = await cookies();
    return verifyCodeCookie(store.get(RECRUIT_COOKIE)?.value, cookieSecret(), now, maxAgeDays);
  } catch {
    return null;
  }
}

export function isUniqueViolation(err: unknown): boolean {
  return typeof err === "object" && err !== null && (err as { code?: string }).code === "P2002";
}
