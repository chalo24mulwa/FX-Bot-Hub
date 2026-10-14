import { createHash, randomUUID } from "node:crypto";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import { recordSecurityEvent } from "@/repositories/security-event-repository";
import { normalizeCode, signCodeCookie } from "@/lib/partnership/codes";
import { decideOrderReferral, decideRegistrationAttribution } from "@/lib/partnership/rules";
import { cookieSecret, getPartnershipSettings, readReferralCookie } from "./core";

// Referral tracking and attribution. The referral code in a URL is only ever a
// *claim*: it is validated against an approved Partner on the server, turned
// into a signed cookie, and re-validated (signature, age, Partner status,
// self-referral) every time it is used. Attribution failures never block the
// action that triggered them — registration and checkout always proceed.

const visitorKey = (visitorId: string) => createHash("sha256").update(`${cookieSecret()}:${visitorId}`).digest("hex");

export function newVisitorId(): string {
  return randomUUID();
}

function utcDay(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

/**
 * A visitor arrived with `?ref=CODE`. Returns the cookie to set, or null when
 * the code isn't an active Partner's (or belongs to the visitor themselves).
 * Records at most one click per Partner, visitor and day.
 */
export async function recordReferralVisit(input: { code: unknown; visitorId: string; path: string; viewerUserId: string | null }) {
  const code = normalizeCode(input.code);
  if (!code) return null;
  const settings = await getPartnershipSettings();
  const partner = await db.partnerProfile.findUnique({ where: { referralCode: code }, select: { id: true, userId: true, status: true } });
  if (!partner || partner.status !== "APPROVED") return null;
  if (input.viewerUserId && input.viewerUserId === partner.userId) return null; // own link: no click, no cookie

  const now = new Date();
  await db.referralClick.createMany({
    data: [{ partnerId: partner.id, visitorKey: visitorKey(input.visitorId), day: utcDay(now), landingPath: input.path.slice(0, 300) }],
    skipDuplicates: true,
  });
  return { value: signCodeCookie(code, now, cookieSecret()), maxAgeSeconds: settings.attributionDays * 86_400 };
}

/** A visitor opened a Master Partner's recruitment link. Returns the cookie to set, or null. */
export async function recordRecruitVisit(input: { code: unknown; viewerUserId: string | null }) {
  const code = normalizeCode(input.code);
  if (!code) return null;
  const settings = await getPartnershipSettings();
  const master = await db.partnerProfile.findUnique({ where: { masterCode: code }, select: { userId: true, status: true, masterStatus: true } });
  if (!master || master.status !== "APPROVED" || master.masterStatus !== "APPROVED") return null;
  if (input.viewerUserId && input.viewerUserId === master.userId) return null;
  return { value: signCodeCookie(code, new Date(), cookieSecret()), maxAgeSeconds: settings.attributionDays * 86_400 };
}

async function partnerFromCookie(now: Date, attributionDays: number) {
  const cookie = await readReferralCookie(now, attributionDays);
  if (!cookie) return null;
  const partner = await db.partnerProfile.findUnique({ where: { referralCode: cookie.code }, select: { id: true, userId: true, status: true } });
  return partner ? { partner, issuedAt: cookie.issuedAt } : null;
}

/**
 * Links a newly registered account to the Partner whose link brought them
 * here. Called right after the account is created (email sign-up and first
 * Google sign-in). Never throws.
 */
export async function attributeRegistration(userId: string): Promise<void> {
  try {
    const settings = await getPartnershipSettings();
    const now = new Date();
    const cookie = await partnerFromCookie(now, settings.attributionDays);
    const decision = decideRegistrationAttribution({ newUserId: userId, cookie, now, attributionDays: settings.attributionDays });
    if (!decision) return;
    // createMany + skipDuplicates: an account that already has an owner keeps it.
    await db.referralAttribution.createMany({
      data: [{ userId, partnerId: decision.partnerId, source: "REGISTRATION", clickedAt: decision.clickedAt }],
      skipDuplicates: true,
    });
  } catch (err) {
    logger.warn("partnership: registration attribution skipped", { userId, error: err instanceof Error ? err.message : String(err) });
  }
}

/**
 * Decides, at checkout, which Partner an order is credited to and records it
 * (OrderReferral). Commission is only created later, from this row, once the
 * order is verified PAID. Never throws — checkout must not depend on it.
 */
export async function recordOrderReferral(orderId: string, buyerId: string): Promise<void> {
  try {
    const settings = await getPartnershipSettings();
    const now = new Date();
    const [ownerRow, cookie] = await Promise.all([
      db.referralAttribution.findUnique({
        where: { userId: buyerId },
        select: { createdAt: true, partner: { select: { id: true, userId: true, status: true } } },
      }),
      partnerFromCookie(now, settings.attributionDays),
    ]);
    const decision = decideOrderReferral({
      buyerId,
      owner: ownerRow ? { partner: ownerRow.partner, attributedAt: ownerRow.createdAt } : null,
      cookie,
      now,
      attributionDays: settings.attributionDays,
      referredUserCommissionDays: settings.referredUserCommissionDays,
    });

    if (decision.kind === "none") {
      if (decision.reason === "self_referral") {
        await recordSecurityEvent({
          userId: buyerId,
          type: "OTHER",
          severity: "LOW",
          metadata: { note: "Partnership: self-referral at checkout ignored", orderId },
        });
      }
      return;
    }
    await db.orderReferral.createMany({
      data: [{ orderId, partnerId: decision.partnerId, source: decision.source }],
      skipDuplicates: true,
    });
  } catch (err) {
    logger.warn("partnership: order referral skipped", { orderId, error: err instanceof Error ? err.message : String(err) });
  }
}
