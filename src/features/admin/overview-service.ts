import { db } from "@/lib/db";
import { can, type PermissionSubject } from "@/lib/authorization/permissions";

// Real, database-backed numbers for the admin overview — nothing hard-coded.
// Each group is only queried (and shown) when the viewer's role may see that area,
// so a scoped moderator's overview doesn't expose financial or partnership figures.

export async function getAdminOverview(viewer: PermissionSubject) {
  const showUsers = can(viewer, "user:view_all");
  const showListings = can(viewer, "product:moderate");
  const showPartnership = can(viewer, "partnership:manage");
  const showFinance = can(viewer, "payout:manage") || can(viewer, "finance:view");
  const showActivity = can(viewer, "admin:view_audit_log");

  const [users, listings, partnership, money, recent] = await Promise.all([
    showUsers
      ? Promise.all([db.user.count(), db.user.count({ where: { bannedAt: null } }), db.user.count({ where: { bannedAt: { not: null } } }), db.user.count({ where: { role: { in: ["SELLER", "AUTHOR"] } } })])
      : null,
    showListings ? db.product.groupBy({ by: ["status"], _count: true }) : null,
    showPartnership
      ? Promise.all([
          db.partnerProfile.count({ where: { status: "PENDING" } }),
          db.partnerProfile.count({ where: { status: "APPROVED" } }),
          db.partnerProfile.count({ where: { masterStatus: "PENDING" } }),
          db.partnerProfile.count({ where: { masterStatus: "APPROVED" } }),
        ])
      : null,
    showFinance
      ? Promise.all([
          db.partnerCommission.count({ where: { status: "PENDING" } }),
          db.partnerPayout.count({ where: { status: "REQUESTED" } }),
          db.payout.count({ where: { status: "PENDING" } }),
        ])
      : null,
    showActivity
      ? db.auditLog.findMany({ orderBy: { createdAt: "desc" }, take: 8, include: { actor: { select: { name: true, email: true } } } })
      : null,
  ]);

  const byStatus = Object.fromEntries((listings ?? []).map((l) => [l.status, l._count])) as Record<string, number>;
  return {
    users: users && { total: users[0], active: users[1], suspended: users[2], sellers: users[3] },
    listings: listings && {
      total: Object.values(byStatus).reduce((a, b) => a + b, 0),
      published: byStatus.PUBLISHED ?? 0,
      pending: (byStatus.PENDING_REVIEW ?? 0) + (byStatus.UNDER_REVIEW ?? 0),
      rejected: byStatus.REJECTED ?? 0,
      suspended: byStatus.SUSPENDED ?? 0,
      removed: byStatus.ARCHIVED ?? 0,
      drafts: byStatus.DRAFT ?? 0,
    },
    partnership: partnership && { pendingPartners: partnership[0], partners: partnership[1], pendingMasters: partnership[2], masters: partnership[3] },
    money: money && { pendingCommissions: money[0], partnerPayoutRequests: money[1], sellerPayoutRequests: money[2] },
    recent,
  };
}
