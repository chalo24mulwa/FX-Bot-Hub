/**
 * Partnership programme rules: who gets credited for an order, how much they
 * earn, when it becomes payable, and what a refund does. Pure functions with
 * no database, environment or clock access — the service layer
 * (src/features/partnership/) loads the data, calls these, and writes the
 * result. Unit-tested in partnership.test.ts.
 *
 * Money is integer cents; rates are basis points (2000 = 20%).
 */

export type PartnerStatusValue = "PENDING" | "APPROVED" | "REJECTED" | "SUSPENDED";
export type MasterStatusValue = "NOT_APPLIED" | "PENDING" | "APPROVED" | "REJECTED" | "SUSPENDED";
export type TierValue = "PARTNER" | "MASTER_PARTNER";
export type CommissionStatusValue = "PENDING" | "APPROVED" | "PAID" | "REVERSED" | "REJECTED";
export type PayoutStatusValue = "REQUESTED" | "APPROVED" | "PAID" | "REJECTED";
export type ReferralSourceValue = "REGISTRATION" | "REFERRAL_LINK";

const DAY_MS = 86_400_000;

export interface PartnerRef {
  id: string;
  userId: string;
  status: PartnerStatusValue;
}

export const isActivePartner = (p: { status: PartnerStatusValue }) => p.status === "APPROVED";
export const isActiveMaster = (p: { status: PartnerStatusValue; masterStatus: MasterStatusValue }) =>
  p.status === "APPROVED" && p.masterStatus === "APPROVED";

// ---------------------------------------------------------------------------
// Attribution
// ---------------------------------------------------------------------------

export interface CookieReferral {
  partner: PartnerRef;
  issuedAt: Date;
}

/**
 * Registration: a new account is owned by the Partner whose link was followed
 * (last valid click within the attribution window). Ownership is written once
 * and never moved.
 */
export function decideRegistrationAttribution(input: {
  newUserId: string;
  cookie: CookieReferral | null;
  now: Date;
  attributionDays: number;
}): { partnerId: string; clickedAt: Date } | null {
  const { cookie } = input;
  if (!cookie) return null;
  if (cookie.partner.userId === input.newUserId) return null;
  if (!isActivePartner(cookie.partner)) return null;
  if (input.now.getTime() - cookie.issuedAt.getTime() > input.attributionDays * DAY_MS) return null;
  return { partnerId: cookie.partner.id, clickedAt: cookie.issuedAt };
}

export type OrderReferralDecision =
  | { kind: "credit"; partnerId: string; source: ReferralSourceValue }
  | { kind: "none"; reason: "no_referral" | "self_referral" | "owner_inactive" | "partner_inactive" | "expired" };

/**
 * Which Partner (if any) an order is credited to, decided at checkout.
 *
 * 1. An account registered through a Partner belongs to that Partner. While
 *    the owner is active (and inside `referredUserCommissionDays`, if set),
 *    every purchase is credited to them — another Partner's link never takes
 *    the account over. A suspended owner earns nothing, and nobody else is
 *    credited instead.
 * 2. Otherwise the last referral link the buyer followed within
 *    `attributionDays` is credited.
 * 3. A Partner is never credited for their own purchase.
 */
export function decideOrderReferral(input: {
  buyerId: string;
  owner: { partner: PartnerRef; attributedAt: Date } | null;
  cookie: CookieReferral | null;
  now: Date;
  attributionDays: number;
  referredUserCommissionDays: number;
}): OrderReferralDecision {
  const { owner, cookie, now } = input;

  if (owner) {
    const ownerWindowOpen =
      input.referredUserCommissionDays <= 0 || now.getTime() - owner.attributedAt.getTime() <= input.referredUserCommissionDays * DAY_MS;
    if (ownerWindowOpen) {
      if (owner.partner.userId === input.buyerId) return { kind: "none", reason: "self_referral" };
      if (!isActivePartner(owner.partner)) return { kind: "none", reason: "owner_inactive" };
      return { kind: "credit", partnerId: owner.partner.id, source: "REGISTRATION" };
    }
  }

  if (!cookie) return { kind: "none", reason: "no_referral" };
  if (cookie.partner.userId === input.buyerId) return { kind: "none", reason: "self_referral" };
  if (!isActivePartner(cookie.partner)) return { kind: "none", reason: "partner_inactive" };
  if (now.getTime() - cookie.issuedAt.getTime() > input.attributionDays * DAY_MS) return { kind: "none", reason: "expired" };
  return { kind: "credit", partnerId: cookie.partner.id, source: "REFERRAL_LINK" };
}

// ---------------------------------------------------------------------------
// Recruitment (one level only)
// ---------------------------------------------------------------------------

export interface MasterRef {
  id: string;
  userId: string;
  status: PartnerStatusValue;
  masterStatus: MasterStatusValue;
  recruitedById: string | null;
}

/**
 * Whether an applicant may record `master` as their recruiter. Never replaces
 * an existing recruiter, never self, never a cycle (the master can't have
 * been recruited by the applicant), and only an active, approved Master
 * Partner can recruit.
 */
export function decideRecruiter(input: {
  applicantUserId: string;
  applicantProfileId: string | null;
  existingRecruitedById: string | null;
  master: MasterRef | null;
}): { masterId: string } | { masterId: null; reason: "none" | "already_recruited" | "self" | "inactive_master" | "cycle" } {
  const { master } = input;
  if (input.existingRecruitedById) return { masterId: null, reason: "already_recruited" };
  if (!master) return { masterId: null, reason: "none" };
  if (master.userId === input.applicantUserId || master.id === input.applicantProfileId) return { masterId: null, reason: "self" };
  if (!isActiveMaster(master)) return { masterId: null, reason: "inactive_master" };
  if (input.applicantProfileId && master.recruitedById === input.applicantProfileId) return { masterId: null, reason: "cycle" };
  return { masterId: master.id };
}

// ---------------------------------------------------------------------------
// Commissions
// ---------------------------------------------------------------------------

/** Floor, so rounding never pays out more than the configured rate. */
export function commissionAmount(basisCents: number, rateBps: number): number {
  if (basisCents <= 0 || rateBps <= 0) return 0;
  return Math.floor((basisCents * rateBps) / 10_000);
}

/**
 * Only an order that is PAID with a verified, successful payment can earn
 * commission. The `manual` development provider "pays" instantly without
 * moving money, so in production it never counts unless explicitly allowed
 * (an override meant for test environments only).
 */
export function isCommissionableOrder(input: {
  orderStatus: string;
  payment: { status: string; provider: string } | null;
  isProduction: boolean;
  allowManualPayments: boolean;
}): boolean {
  if (input.orderStatus !== "PAID") return false;
  if (!input.payment || input.payment.status !== "SUCCEEDED") return false;
  if (input.payment.provider === "MANUAL" && input.isProduction && !input.allowManualPayments) return false;
  return true;
}

export interface CommissionItemInput {
  orderItemId: string;
  basisCents: number;
  categoryId: string | null;
}

export interface CommissionPartnerInput {
  id: string;
  userId: string;
  status: PartnerStatusValue;
  masterStatus: MasterStatusValue;
  /** The confirmed recruiter (recruitedAt set), loaded by the caller; null if none. */
  recruiter: { id: string; userId: string; status: PartnerStatusValue; masterStatus: MasterStatusValue } | null;
}

export interface PlannedCommission {
  orderItemId: string;
  beneficiaryId: string;
  beneficiaryTier: TierValue;
  type: TierValue;
  rateBps: number;
  basisCents: number;
  amountCents: number;
  referringPartnerId: string;
  masterPartnerId: string | null;
}

/**
 * The commissions one paid order produces.
 *
 * - The credited Partner earns `partnerRateBps` of each eligible item.
 * - If that Partner was recruited by a Master Partner who is still active,
 *   the Master Partner additionally earns `masterRateBps` of the same basis —
 *   a separate entry paid by FX Bot Hub, never deducted from the Partner.
 * - A Master Partner's own referrals earn only the standard rate.
 * - Nobody earns commission on their own purchase.
 */
export function planOrderCommissions(input: {
  buyerId: string;
  partner: CommissionPartnerInput;
  items: CommissionItemInput[];
  partnerRateBps: number;
  masterRateBps: number;
  eligibleCategoryIds: string[];
}): PlannedCommission[] {
  const { partner, buyerId } = input;
  if (!isActivePartner(partner) || partner.userId === buyerId) return [];

  const recruiter = partner.recruiter;
  const masterEarns =
    recruiter !== null && recruiter.id !== partner.id && recruiter.userId !== buyerId && isActiveMaster(recruiter) && input.masterRateBps > 0;

  const eligible = (item: CommissionItemInput) =>
    item.basisCents > 0 && (input.eligibleCategoryIds.length === 0 || (item.categoryId !== null && input.eligibleCategoryIds.includes(item.categoryId)));

  const out: PlannedCommission[] = [];
  for (const item of input.items) {
    if (!eligible(item)) continue;
    const partnerAmount = commissionAmount(item.basisCents, input.partnerRateBps);
    if (partnerAmount > 0) {
      out.push({
        orderItemId: item.orderItemId,
        beneficiaryId: partner.id,
        beneficiaryTier: partner.masterStatus === "APPROVED" ? "MASTER_PARTNER" : "PARTNER",
        type: "PARTNER",
        rateBps: input.partnerRateBps,
        basisCents: item.basisCents,
        amountCents: partnerAmount,
        referringPartnerId: partner.id,
        masterPartnerId: masterEarns ? recruiter!.id : null,
      });
    }
    if (masterEarns) {
      const masterAmount = commissionAmount(item.basisCents, input.masterRateBps);
      if (masterAmount > 0) {
        out.push({
          orderItemId: item.orderItemId,
          beneficiaryId: recruiter!.id,
          beneficiaryTier: "MASTER_PARTNER",
          type: "MASTER_PARTNER",
          rateBps: input.masterRateBps,
          basisCents: item.basisCents,
          amountCents: masterAmount,
          referringPartnerId: partner.id,
          masterPartnerId: recruiter!.id,
        });
      }
    }
  }
  return out;
}

export function holdUntil(paidAt: Date, holdDays: number): Date {
  return new Date(paidAt.getTime() + Math.max(0, holdDays) * DAY_MS);
}

// ---------------------------------------------------------------------------
// Refunds / reversals
// ---------------------------------------------------------------------------

export interface CommissionForReversal {
  id: string;
  status: CommissionStatusValue;
  payoutId: string | null;
  payoutStatus: PayoutStatusValue | null;
}

/**
 * What a refund or chargeback does to an order's commissions. Unpaid ones are
 * reversed (and pulled out of any payout request that hasn't been paid yet).
 * Ones already paid out are left as they are and flagged for an admin —
 * nothing is clawed back automatically.
 */
export function planReversal(commissions: CommissionForReversal[]): {
  reverse: { id: string; detachFromPayoutId: string | null }[];
  alreadyPaid: string[];
} {
  const reverse: { id: string; detachFromPayoutId: string | null }[] = [];
  const alreadyPaid: string[] = [];
  for (const c of commissions) {
    if (c.status === "PAID" || c.payoutStatus === "PAID") alreadyPaid.push(c.id);
    else if (c.status === "PENDING" || c.status === "APPROVED") reverse.push({ id: c.id, detachFromPayoutId: c.payoutId });
  }
  return { reverse, alreadyPaid };
}

// ---------------------------------------------------------------------------
// Balances and payouts
// ---------------------------------------------------------------------------

export interface CommissionForSummary {
  status: CommissionStatusValue;
  amountCents: number;
  currency: string;
  payoutId: string | null;
}

export interface CommissionTotals {
  currency: string;
  pending: number;
  approved: number;
  /** Approved and not yet part of a payout request. */
  available: number;
  inPayout: number;
  paid: number;
  reversed: number;
  rejected: number;
}

export function summarizeCommissions(rows: CommissionForSummary[]): CommissionTotals[] {
  const byCurrency = new Map<string, CommissionTotals>();
  for (const r of rows) {
    const t =
      byCurrency.get(r.currency) ??
      { currency: r.currency, pending: 0, approved: 0, available: 0, inPayout: 0, paid: 0, reversed: 0, rejected: 0 };
    switch (r.status) {
      case "PENDING":
        t.pending += r.amountCents;
        break;
      case "APPROVED":
        t.approved += r.amountCents;
        if (r.payoutId) t.inPayout += r.amountCents;
        else t.available += r.amountCents;
        break;
      case "PAID":
        t.paid += r.amountCents;
        break;
      case "REVERSED":
        t.reversed += r.amountCents;
        break;
      case "REJECTED":
        t.rejected += r.amountCents;
        break;
    }
    byCurrency.set(r.currency, t);
  }
  return [...byCurrency.values()].sort((a, b) => a.currency.localeCompare(b.currency));
}

export type PayoutPlan =
  | { ok: true; amountCents: number; commissionIds: string[] }
  | { ok: false; reason: string };

/**
 * A payout request takes every approved, unpaid commission in one currency.
 * Commissions whose order is no longer PAID (refunded since approval) are
 * never included.
 */
export function planPayout(input: {
  partnerStatus: PartnerStatusValue;
  hasOpenPayout: boolean;
  minPayoutCents: number;
  commissions: { id: string; status: CommissionStatusValue; payoutId: string | null; amountCents: number; orderStatus: string }[];
}): PayoutPlan {
  if (input.partnerStatus !== "APPROVED") return { ok: false, reason: "Only an active Partner can request a payout." };
  if (input.hasOpenPayout) return { ok: false, reason: "You already have a payout request in progress for this currency." };
  const usable = input.commissions.filter((c) => c.status === "APPROVED" && !c.payoutId && c.orderStatus === "PAID");
  const amountCents = usable.reduce((sum, c) => sum + c.amountCents, 0);
  if (amountCents <= 0) return { ok: false, reason: "You have no approved commission available for payout yet." };
  if (amountCents < input.minPayoutCents) return { ok: false, reason: "Your available balance is below the minimum payout." };
  return { ok: true, amountCents, commissionIds: usable.map((c) => c.id) };
}

// ---------------------------------------------------------------------------
// Presentation helpers
// ---------------------------------------------------------------------------

export function formatRate(bps: number): string {
  const pct = bps / 100;
  return `${Number.isInteger(pct) ? pct : pct.toFixed(2)}%`;
}

/** Like formatPriceCents, but shows 0 as "$0.00" rather than "Free". */
export function formatMoney(cents: number, currency: string): string {
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(cents / 100);
  } catch {
    return `${(cents / 100).toFixed(2)} ${currency}`;
  }
}

/** Privacy-safe label for a referred member: their public display name, or an anonymous handle. */
export function referredMemberLabel(displayName: string | null | undefined, userId: string): string {
  const name = displayName?.trim();
  if (name) return name.length > 40 ? `${name.slice(0, 39)}…` : name;
  return `Member #${userId.slice(-6).toUpperCase()}`;
}

/** "07xx xxx 123" → "•••• 123": payout destinations are shown masked to the Partner. */
export function maskDestination(destination: string): string {
  const trimmed = destination.trim();
  if (trimmed.length <= 4) return "••••";
  return `•••• ${trimmed.slice(-4)}`;
}
