import type { PartnerCommissionStatus, PartnerStatus, MasterPartnerStatus, PartnerTier, Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { referredMemberLabel, summarizeCommissions } from "@/lib/partnership/rules";
import { getPartnershipSettings } from "./core";
import { releaseMaturedCommissions } from "./commission-service";

// Read models for the Partner dashboard and the admin pages. Every Partner
// query is scoped by the caller's own PartnerProfile id — a Partner can never
// read another Partner's rows — and referred members are only ever shown by
// display name or an anonymous label (never email or account details).

export const PAGE_SIZE = 20;
const LIVE_STATUSES: PartnerCommissionStatus[] = ["PENDING", "APPROVED", "PAID"];

export async function getMyPartnerProfile(userId: string) {
  return db.partnerProfile.findUnique({
    where: { userId },
    include: { recruitedBy: { select: { id: true, user: { select: { name: true, profile: { select: { displayName: true } } } } } } },
  });
}

export type MyPartnerProfile = NonNullable<Awaited<ReturnType<typeof getMyPartnerProfile>>>;

function sumByCurrency(rows: { currency: string; _sum: { basisCents: number | null; amountCents: number | null } }[]) {
  return rows.map((r) => ({ currency: r.currency, basisCents: r._sum.basisCents ?? 0, amountCents: r._sum.amountCents ?? 0 }));
}

/** The Overview cards. All figures come from rows in the database. */
export async function getPartnerOverview(profileId: string) {
  await releaseMaturedCommissions();
  const [clicks, registered, buyers, sales, commissionRows, paidOut] = await Promise.all([
    db.referralClick.count({ where: { partnerId: profileId } }),
    db.referralAttribution.count({ where: { partnerId: profileId } }),
    db.partnerCommission.findMany({
      where: { beneficiaryId: profileId, type: "PARTNER", status: { in: LIVE_STATUSES } },
      distinct: ["buyerId"],
      select: { buyerId: true },
    }),
    db.partnerCommission.groupBy({
      by: ["currency"],
      where: { beneficiaryId: profileId, type: "PARTNER", status: { in: LIVE_STATUSES } },
      _sum: { basisCents: true, amountCents: true },
    }),
    db.partnerCommission.findMany({ where: { beneficiaryId: profileId }, select: { status: true, amountCents: true, currency: true, payoutId: true } }),
    db.partnerPayout.groupBy({ by: ["currency"], where: { partnerId: profileId, status: "PAID" }, _sum: { amountCents: true } }),
  ]);
  return {
    clicks,
    registered,
    purchasers: buyers.length,
    eligibleSales: sumByCurrency(sales),
    totals: summarizeCommissions(commissionRows),
    paidOut: paidOut.map((p) => ({ currency: p.currency, amountCents: p._sum.amountCents ?? 0 })),
  };
}

export async function getMasterOverview(profileId: string) {
  const [recruited, activeRecruits, pendingApplications, sales, rows] = await Promise.all([
    db.partnerProfile.count({ where: { recruitedById: profileId, recruitedAt: { not: null } } }),
    db.partnerProfile.count({ where: { recruitedById: profileId, recruitedAt: { not: null }, status: "APPROVED" } }),
    db.partnerProfile.count({ where: { recruitedById: profileId, recruitedAt: null, status: "PENDING" } }),
    db.partnerCommission.groupBy({
      by: ["currency"],
      where: { beneficiaryId: profileId, type: "MASTER_PARTNER", status: { in: LIVE_STATUSES } },
      _sum: { basisCents: true, amountCents: true },
    }),
    db.partnerCommission.findMany({
      where: { beneficiaryId: profileId, type: "MASTER_PARTNER" },
      select: { status: true, amountCents: true, currency: true, payoutId: true },
    }),
  ]);
  return { recruited, activeRecruits, pendingApplications, eligibleSales: sumByCurrency(sales), totals: summarizeCommissions(rows) };
}

/** Unique referral visits and registrations per day over the last `days` days. */
export async function getReferralPerformance(profileId: string, days: number) {
  const since = new Date(Date.now() - days * 86_400_000);
  const [clicks, registrations] = await Promise.all([
    db.referralClick.groupBy({ by: ["day"], where: { partnerId: profileId, day: { gte: since } }, _count: { _all: true } }),
    db.referralAttribution.findMany({ where: { partnerId: profileId, createdAt: { gte: since } }, select: { createdAt: true } }),
  ]);
  const totalClicks = clicks.reduce((s, c) => s + c._count._all, 0);
  return {
    totalClicks,
    registrations: registrations.length,
    conversionPercent: totalClicks > 0 ? Math.round((registrations.length / totalClicks) * 1000) / 10 : null,
    byDay: clicks.map((c) => ({ day: c.day.toISOString().slice(0, 10), clicks: c._count._all })).sort((a, b) => a.day.localeCompare(b.day)),
  };
}

export async function listReferredUsers(profileId: string, opts: { q?: string; page: number }) {
  const q = opts.q?.trim().slice(0, 60);
  const where: Prisma.ReferralAttributionWhereInput = {
    partnerId: profileId,
    ...(q ? { user: { profile: { displayName: { contains: q.replace(/[%_]/g, ""), mode: "insensitive" } } } } : {}),
  };
  const [rows, total] = await Promise.all([
    db.referralAttribution.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (opts.page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: { userId: true, createdAt: true, user: { select: { profile: { select: { displayName: true } } } } },
    }),
    db.referralAttribution.count({ where }),
  ]);
  const totals = rows.length
    ? await db.partnerCommission.groupBy({
        by: ["buyerId", "currency"],
        where: { beneficiaryId: profileId, type: "PARTNER", status: { in: LIVE_STATUSES }, buyerId: { in: rows.map((r) => r.userId) } },
        _sum: { basisCents: true, amountCents: true },
      })
    : [];
  return {
    total,
    items: rows.map((r) => {
      const mine = totals.filter((t) => t.buyerId === r.userId);
      return {
        key: r.userId.slice(-8),
        label: referredMemberLabel(r.user.profile?.displayName, r.userId),
        registeredAt: r.createdAt,
        purchased: mine.length > 0,
        sales: mine.map((t) => ({ currency: t.currency, basisCents: t._sum.basisCents ?? 0, amountCents: t._sum.amountCents ?? 0 })),
      };
    }),
  };
}

/** Orders credited to this Partner (Sales & Purchases). */
export async function listAttributedOrders(profileId: string, page: number) {
  const where = { partnerId: profileId };
  const [rows, total] = await Promise.all([
    db.orderReferral.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        source: true,
        createdAt: true,
        order: {
          select: {
            id: true,
            status: true,
            currency: true,
            userId: true,
            user: { select: { profile: { select: { displayName: true } } } },
            items: { select: { product: { select: { name: true } } } },
            partnerCommissions: { where: { beneficiaryId: profileId, type: "PARTNER" }, select: { basisCents: true, amountCents: true, status: true } },
          },
        },
      },
    }),
    db.orderReferral.count({ where }),
  ]);
  return {
    total,
    items: rows.map((r) => ({
      reference: r.order.id.slice(-8).toUpperCase(),
      date: r.createdAt,
      source: r.source,
      buyer: referredMemberLabel(r.order.user.profile?.displayName, r.order.userId),
      products: r.order.items.map((i) => i.product.name),
      orderStatus: r.order.status,
      currency: r.order.currency,
      basisCents: r.order.partnerCommissions.reduce((s, c) => s + c.basisCents, 0),
      commissionCents: r.order.partnerCommissions.filter((c) => LIVE_STATUSES.includes(c.status)).reduce((s, c) => s + c.amountCents, 0),
      commissionStatuses: [...new Set(r.order.partnerCommissions.map((c) => c.status))],
    })),
  };
}

export async function listMyCommissions(profileId: string, opts: { status?: string; type?: string; page: number }) {
  await releaseMaturedCommissions();
  const where: Prisma.PartnerCommissionWhereInput = {
    beneficiaryId: profileId,
    ...(opts.status ? { status: opts.status as PartnerCommissionStatus } : {}),
    ...(opts.type ? { type: opts.type as PartnerTier } : {}),
  };
  const [rows, total] = await Promise.all([
    db.partnerCommission.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (opts.page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: { orderItem: { select: { product: { select: { name: true } } } } },
    }),
    db.partnerCommission.count({ where }),
  ]);
  return { total, items: rows };
}

export async function listMyPayouts(profileId: string) {
  return db.partnerPayout.findMany({ where: { partnerId: profileId }, orderBy: { requestedAt: "desc" }, take: 50 });
}

export async function listMyRecruits(profileId: string) {
  const recruits = await db.partnerProfile.findMany({
    where: { recruitedById: profileId },
    orderBy: { appliedAt: "desc" },
    take: 200,
    select: {
      id: true,
      userId: true,
      status: true,
      appliedAt: true,
      decidedAt: true,
      recruitedAt: true,
      user: { select: { profile: { select: { displayName: true } } } },
    },
  });
  const sales = recruits.length
    ? await db.partnerCommission.groupBy({
        by: ["referringPartnerId", "currency"],
        where: { beneficiaryId: profileId, type: "MASTER_PARTNER", status: { in: LIVE_STATUSES }, referringPartnerId: { in: recruits.map((r) => r.id) } },
        _sum: { basisCents: true, amountCents: true },
      })
    : [];
  return recruits.map((r) => ({
    key: r.id.slice(-8),
    label: referredMemberLabel(r.user.profile?.displayName, r.userId),
    status: r.status,
    confirmed: r.recruitedAt !== null,
    appliedAt: r.appliedAt,
    approvedAt: r.recruitedAt,
    sales: sales
      .filter((s) => s.referringPartnerId === r.id)
      .map((s) => ({ currency: s.currency, basisCents: s._sum.basisCents ?? 0, amountCents: s._sum.amountCents ?? 0 })),
  }));
}

export async function listShareableProducts() {
  return db.product.findMany({
    where: { status: "PUBLISHED" },
    orderBy: { createdAt: "desc" },
    take: 300,
    select: { slug: true, name: true, platform: true },
  });
}

// ---------------------------------------------------------------------------
// Admin
// ---------------------------------------------------------------------------

export async function getAdminProgrammeOverview() {
  await releaseMaturedCommissions();
  const [pendingPartners, pendingMasters, approvedPartners, approvedMasters, openPayouts, commissionRows] = await Promise.all([
    db.partnerProfile.count({ where: { status: "PENDING" } }),
    db.partnerProfile.count({ where: { masterStatus: "PENDING" } }),
    db.partnerProfile.count({ where: { status: "APPROVED" } }),
    db.partnerProfile.count({ where: { masterStatus: "APPROVED" } }),
    db.partnerPayout.count({ where: { status: { in: ["REQUESTED", "APPROVED"] } } }),
    db.partnerCommission.groupBy({ by: ["status", "currency"], _sum: { amountCents: true } }),
  ]);
  return {
    pendingPartners,
    pendingMasters,
    approvedPartners,
    approvedMasters,
    openPayouts,
    commissions: commissionRows.map((r) => ({ status: r.status, currency: r.currency, amountCents: r._sum.amountCents ?? 0 })),
  };
}

export async function listPartnersForAdmin(opts: { status?: string; master?: string; q?: string; page: number }) {
  const q = opts.q?.trim().slice(0, 80).replace(/[%_]/g, "");
  const where: Prisma.PartnerProfileWhereInput = {
    ...(opts.status ? { status: opts.status as PartnerStatus } : {}),
    ...(opts.master ? { masterStatus: opts.master as MasterPartnerStatus } : {}),
    ...(q
      ? {
          OR: [
            { referralCode: { equals: q.toUpperCase() } },
            { masterCode: { equals: q.toUpperCase() } },
            { user: { email: { contains: q, mode: "insensitive" } } },
            { user: { name: { contains: q, mode: "insensitive" } } },
          ],
        }
      : {}),
  };
  const [items, total] = await Promise.all([
    db.partnerProfile.findMany({
      where,
      orderBy: [{ appliedAt: "desc" }],
      skip: (opts.page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: {
        user: { select: { name: true, email: true } },
        _count: { select: { referredUsers: true, recruits: true, clicks: true } },
      },
    }),
    db.partnerProfile.count({ where }),
  ]);
  return { items, total };
}

export async function getPartnerForAdmin(id: string) {
  const profile = await db.partnerProfile.findUnique({
    where: { id },
    include: {
      user: { select: { id: true, name: true, email: true, createdAt: true, bannedAt: true } },
      recruitedBy: { select: { id: true, masterCode: true, user: { select: { name: true, email: true } } } },
      recruits: { select: { id: true, status: true, recruitedAt: true, appliedAt: true, user: { select: { name: true, email: true } } }, orderBy: { appliedAt: "desc" }, take: 100 },
      _count: { select: { referredUsers: true, clicks: true, orderReferrals: true } },
    },
  });
  if (!profile) return null;
  await releaseMaturedCommissions();
  const [commissionRows, recentCommissions, payouts, audit, security, clicksLast24h] = await Promise.all([
    db.partnerCommission.findMany({ where: { beneficiaryId: id }, select: { status: true, amountCents: true, currency: true, payoutId: true } }),
    db.partnerCommission.findMany({
      where: { beneficiaryId: id },
      orderBy: { createdAt: "desc" },
      take: 25,
      include: { orderItem: { select: { product: { select: { name: true } } } } },
    }),
    db.partnerPayout.findMany({ where: { partnerId: id }, orderBy: { requestedAt: "desc" }, take: 20 }),
    db.auditLog.findMany({
      where: { entityType: "PartnerProfile", entityId: id },
      orderBy: { createdAt: "desc" },
      take: 30,
      include: { actor: { select: { name: true, email: true } } },
    }),
    db.securityEvent.findMany({
      where: { userId: profile.userId },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
    // Clicks from the Partner's own browser are never recorded, so a burst of
    // unique visits with no registrations is the main thing worth a look.
    db.referralClick.count({ where: { partnerId: id, createdAt: { gte: new Date(Date.now() - 86_400_000) } } }),
  ]);
  return { profile, totals: summarizeCommissions(commissionRows), recentCommissions, payouts, audit, security, clicksLast24h };
}

export async function listCommissionsForAdmin(opts: { status?: string; type?: string; q?: string; page: number }) {
  await releaseMaturedCommissions();
  const q = opts.q?.trim();
  const where: Prisma.PartnerCommissionWhereInput = {
    ...(opts.status ? { status: opts.status as PartnerCommissionStatus } : {}),
    ...(opts.type ? { type: opts.type as PartnerTier } : {}),
    ...(q ? { OR: [{ orderId: q }, { id: q }, { beneficiary: { referralCode: q.toUpperCase() } }] } : {}),
  };
  const [items, total] = await Promise.all([
    db.partnerCommission.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (opts.page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: {
        beneficiary: { select: { id: true, referralCode: true, user: { select: { name: true, email: true } } } },
        order: { select: { status: true } },
        orderItem: { select: { product: { select: { name: true } } } },
        payout: { select: { status: true } },
      },
    }),
    db.partnerCommission.count({ where }),
  ]);
  return { items, total };
}

export async function listPayoutsForAdmin(status?: string) {
  return db.partnerPayout.findMany({
    where: status ? { status: status as "REQUESTED" | "APPROVED" | "PAID" | "REJECTED" } : {},
    orderBy: { requestedAt: "desc" },
    take: 100,
    include: { partner: { select: { id: true, referralCode: true, status: true, user: { select: { name: true, email: true } } } }, _count: { select: { commissions: true } } },
  });
}

export async function getSettingsForAdmin() {
  const [settings, categories] = await Promise.all([
    getPartnershipSettings(),
    db.productCategory.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);
  return { settings, categories };
}

/** Rows for the CSV export (admin only), newest first, bounded. */
export async function exportCommissionRows(from: Date, to: Date) {
  return db.partnerCommission.findMany({
    where: { createdAt: { gte: from, lte: to } },
    orderBy: { createdAt: "desc" },
    take: 20_000,
    include: { beneficiary: { select: { referralCode: true, user: { select: { email: true } } } } },
  });
}
