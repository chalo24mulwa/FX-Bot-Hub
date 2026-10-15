import { z } from "zod";
import type { Prisma, UserRole } from "@prisma/client";
import { db } from "@/lib/db";
import { cleanReason, evaluateRoleChange, evaluateSuspension, requireReason } from "@/lib/admin/rules";
import { recordAuditLog } from "@/repositories/audit-log-repository";
import { requestPasswordReset } from "@/features/auth/password-reset-service";
import { AdminError, type AdminActor } from "./core";

const USER_ROLES: UserRole[] = ["USER", "SELLER", "AUTHOR", "MODERATOR", "ADMIN", "SUPER_ADMIN"];

/** Re-reads the acting administrator from the database (never trust a role that arrived with the request). */
export async function loadActor(actorId: string, ipAddress?: string): Promise<AdminActor> {
  const user = await db.user.findUnique({ where: { id: actorId }, select: { id: true, role: true, bannedAt: true } });
  if (!user || user.bannedAt) throw new AdminError("Your account can't do that.", 403);
  const grants = user.role === "MODERATOR" ? await db.adminRoleGrant.findMany({ where: { userId: user.id }, select: { role: true } }) : [];
  return { id: user.id, role: user.role, adminRoles: grants.map((g) => g.role), ipAddress };
}

// ---------------------------------------------------------------------------
// Search
// ---------------------------------------------------------------------------

export interface UserSearchFilter {
  q?: string;
  role?: string;
  status?: string; // active | suspended
  seller?: string; // yes | no
  partnership?: string; // none | pending | approved | suspended | master
}

const ID_SHAPE = /^[A-Za-z0-9_-]{20,40}$/;

export function buildUserWhere(filter: UserSearchFilter): Prisma.UserWhereInput {
  const and: Prisma.UserWhereInput[] = [];
  const q = filter.q?.trim().slice(0, 100);
  if (q) {
    // `%` and `_` are LIKE wildcards in Prisma's `contains`; treat them as plain text.
    const term = q.replace(/[%_\\]+/g, " ").replace(/\s+/g, " ").trim();
    const or: Prisma.UserWhereInput[] = [];
    if (term) {
      or.push({ name: { contains: term, mode: "insensitive" } }, { email: { contains: term, mode: "insensitive" } }, { profile: { displayName: { contains: term, mode: "insensitive" } } });
    }
    if (ID_SHAPE.test(q)) or.push({ id: q });
    and.push(or.length ? { OR: or } : { id: "__no_match__" });
  }
  if (filter.role && (USER_ROLES as string[]).includes(filter.role)) and.push({ role: filter.role as UserRole });
  if (filter.status === "suspended") and.push({ bannedAt: { not: null } });
  if (filter.status === "active") and.push({ bannedAt: null });
  if (filter.seller === "yes") and.push({ OR: [{ role: { in: ["SELLER", "AUTHOR"] } }, { sellerProfile: { isNot: null } }] });
  if (filter.seller === "no") and.push({ role: { notIn: ["SELLER", "AUTHOR"] }, sellerProfile: { is: null } });
  if (filter.partnership === "none") and.push({ partnerProfile: { is: null } });
  if (filter.partnership === "pending") and.push({ partnerProfile: { is: { status: "PENDING" } } });
  if (filter.partnership === "approved") and.push({ partnerProfile: { is: { status: "APPROVED" } } });
  if (filter.partnership === "suspended") and.push({ partnerProfile: { is: { status: "SUSPENDED" } } });
  if (filter.partnership === "master") and.push({ partnerProfile: { is: { masterStatus: "APPROVED" } } });
  return and.length ? { AND: and } : {};
}

export async function searchUsers(filter: UserSearchFilter, page: number, pageSize: number) {
  const where = buildUserWhere(filter);
  const safePage = Math.max(1, Math.floor(page) || 1);
  const [items, total] = await Promise.all([
    db.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (safePage - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        bannedAt: true,
        createdAt: true,
        sellerProfile: { select: { displayName: true } },
        partnerProfile: { select: { status: true, masterStatus: true } },
        adminRoleGrants: { select: { role: true } },
      },
    }),
    db.user.count({ where }),
  ]);
  return { items, total, page: safePage, pageSize };
}

// ---------------------------------------------------------------------------
// Detail
// ---------------------------------------------------------------------------

export async function getUserDetail(userId: string) {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      email: true,
      emailVerified: true,
      role: true,
      bannedAt: true,
      mustChangePassword: true,
      createdAt: true,
      // Selected only to answer "does this account have a password?" — never returned.
      password: true,
      profile: { select: { displayName: true, bio: true, location: true, websiteUrl: true, username: true } },
      sellerProfile: { select: { displayName: true } },
      accounts: { select: { provider: true } },
      adminRoleGrants: { select: { role: true, createdAt: true, reason: true } },
      partnerProfile: {
        select: { id: true, status: true, masterStatus: true, referralCode: true, masterCode: true, appliedAt: true, decidedAt: true, decisionReason: true, recruitedById: true },
      },
    },
  });
  if (!user) return null;
  const { password, ...safe } = user;

  const profileId = user.partnerProfile?.id;
  const [products, orders, licenses, subscriptions, payouts, ledgerEntries, commissions, referred, recentAudit] = await Promise.all([
    db.product.groupBy({ by: ["status"], where: { sellerId: userId }, _count: true }),
    db.order.count({ where: { userId } }),
    db.license.count({ where: { userId } }),
    db.subscription.count({ where: { userId } }),
    db.payout.count({ where: { sellerId: userId } }),
    db.ledgerEntry.count({ where: { sellerId: userId } }),
    profileId ? db.partnerCommission.count({ where: { beneficiaryId: profileId } }) : Promise.resolve(0),
    profileId ? db.referralAttribution.count({ where: { partnerId: profileId } }) : Promise.resolve(0),
    db.auditLog.findMany({
      where: { entityType: "User", entityId: userId },
      orderBy: { createdAt: "desc" },
      take: 15,
      include: { actor: { select: { name: true, email: true } } },
    }),
  ]);

  const listings = Object.fromEntries(products.map((p) => [p.status, p._count])) as Record<string, number>;
  const listingTotal = products.reduce((n, p) => n + p._count, 0);
  const dependencies = { listings: listingTotal, orders, licenses, subscriptions, sellerPayouts: payouts, ledgerEntries, partnerCommissions: commissions, referredMembers: referred };

  return {
    user: { ...safe, hasPassword: password !== null, linkedProviders: user.accounts.map((a) => a.provider) },
    listings,
    dependencies,
    // Why deletion isn't offered: these records are financial or audit history and must outlive the account.
    hasHistory: Object.values(dependencies).some((n) => n > 0),
    recentAudit,
  };
}

// ---------------------------------------------------------------------------
// Edits
// ---------------------------------------------------------------------------

const profileSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters.").max(80),
  displayName: z.string().trim().max(80).optional(),
  bio: z.string().trim().max(500).optional(),
  location: z.string().trim().max(80).optional(),
});

/** Permitted profile fields only — never email, role, password or ownership. */
export async function updateUserProfile(actor: AdminActor, userId: string, input: unknown, rawReason: unknown) {
  const data = profileSchema.parse(input);
  const reason = requireReason(rawReason);
  if (!reason.ok) throw new AdminError(reason.error);

  const user = await db.user.findUnique({ where: { id: userId }, select: { id: true, name: true, role: true, profile: { select: { displayName: true, bio: true, location: true } } } });
  if (!user) throw new AdminError("That member wasn't found.", 404);
  if (user.id !== actor.id && (user.role === "ADMIN" || user.role === "SUPER_ADMIN") && actor.role !== "SUPER_ADMIN") {
    throw new AdminError("Only a Super Administrator can edit an administrator's profile.", 403);
  }

  const next = { displayName: data.displayName || null, bio: data.bio || null, location: data.location || null };
  await db.$transaction([
    db.user.update({ where: { id: userId }, data: { name: data.name } }),
    db.profile.upsert({ where: { userId }, update: next, create: { userId, ...next } }),
  ]);

  const trunc = (v: string | null | undefined) => (v ? v.slice(0, 80) : null);
  await recordAuditLog({
    actorId: actor.id,
    action: "user.profile_edit",
    entityType: "User",
    entityId: userId,
    ipAddress: actor.ipAddress,
    metadata: {
      reason: reason.reason,
      before: { name: trunc(user.name), displayName: trunc(user.profile?.displayName), location: trunc(user.profile?.location), bio: user.profile?.bio ? "(set)" : null },
      after: { name: trunc(data.name), displayName: trunc(next.displayName), location: trunc(next.location), bio: next.bio ? "(set)" : null },
    },
  });
}

/** Role change with the escalation rules enforced; serializable so two admins can't race the last-Super-Admin check. */
export async function changeUserRoleChecked(actor: AdminActor, userId: string, newRole: UserRole, rawReason: unknown) {
  if (!USER_ROLES.includes(newRole)) throw new AdminError("Unknown role.");
  const reason = requireReason(rawReason);
  if (!reason.ok) throw new AdminError(reason.error);

  await db.$transaction(
    async (tx) => {
      const [actorRow, target, activeSuperAdmins] = await Promise.all([
        tx.user.findUnique({ where: { id: actor.id }, select: { id: true, role: true, bannedAt: true } }),
        tx.user.findUnique({ where: { id: userId }, select: { id: true, role: true, bannedAt: true } }),
        tx.user.count({ where: { role: "SUPER_ADMIN", bannedAt: null } }),
      ]);
      if (!actorRow || actorRow.bannedAt) throw new AdminError("Your account can't do that.", 403);
      if (!target) throw new AdminError("That member wasn't found.", 404);

      const decision = evaluateRoleChange({ actor: actorRow, target, newRole, activeSuperAdmins });
      if (!decision.ok) throw new AdminError(decision.error, 403);

      await tx.user.update({ where: { id: userId }, data: { role: newRole } });
      // Admin-role grants only mean something on a moderator-level account.
      const cleared = newRole === "MODERATOR" ? { count: 0 } : await tx.adminRoleGrant.deleteMany({ where: { userId } });
      await tx.auditLog.create({
        data: {
          actorId: actor.id,
          action: "user.role_change",
          entityType: "User",
          entityId: userId,
          ipAddress: actor.ipAddress,
          metadata: { from: target.role, to: newRole, reason: reason.reason, clearedAdminRoles: cleared.count },
        },
      });
    },
    { isolationLevel: "Serializable" },
  );
}

export async function setUserSuspendedChecked(actor: AdminActor, userId: string, suspending: boolean, rawReason: unknown) {
  const reason = suspending ? requireReason(rawReason) : { ok: true as const, reason: cleanReason(rawReason) };
  if (!reason.ok) throw new AdminError(reason.error);

  await db.$transaction(
    async (tx) => {
      const [actorRow, target, activeSuperAdmins] = await Promise.all([
        tx.user.findUnique({ where: { id: actor.id }, select: { id: true, role: true, bannedAt: true } }),
        tx.user.findUnique({ where: { id: userId }, select: { id: true, role: true, bannedAt: true } }),
        tx.user.count({ where: { role: "SUPER_ADMIN", bannedAt: null } }),
      ]);
      if (!actorRow || actorRow.bannedAt) throw new AdminError("Your account can't do that.", 403);
      if (!target) throw new AdminError("That member wasn't found.", 404);

      const decision = evaluateSuspension({ actor: actorRow, target, suspending, activeSuperAdmins });
      if (!decision.ok) throw new AdminError(decision.error, 403);

      await tx.user.update({ where: { id: userId }, data: { bannedAt: suspending ? new Date() : null } });
      if (suspending) {
        // Any admin currently viewing as this member is handed their own session back.
        await tx.impersonationSession.updateMany({ where: { targetUserId: userId, endedAt: null }, data: { endedAt: new Date(), endReason: "target_unavailable" } });
      }
      await tx.auditLog.create({
        data: {
          actorId: actor.id,
          action: suspending ? "user.suspend" : "user.reactivate",
          entityType: "User",
          entityId: userId,
          ipAddress: actor.ipAddress,
          metadata: { reason: reason.reason || null },
        },
      });
    },
    { isolationLevel: "Serializable" },
  );
}

/**
 * Sends the member a password-reset link. The administrator never sees a
 * password or a token — the link goes only to the member's own email, exactly
 * as if they had used "Forgot password".
 */
export async function initiateUserPasswordReset(actor: AdminActor, userId: string, rawReason: unknown) {
  const reason = requireReason(rawReason);
  if (!reason.ok) throw new AdminError(reason.error);

  const user = await db.user.findUnique({ where: { id: userId }, select: { id: true, email: true, role: true, bannedAt: true, password: true } });
  if (!user) throw new AdminError("That member wasn't found.", 404);
  if (user.id !== actor.id && (user.role === "ADMIN" || user.role === "SUPER_ADMIN") && actor.role !== "SUPER_ADMIN") {
    throw new AdminError("Only a Super Administrator can reset an administrator's password.", 403);
  }
  if (user.bannedAt) throw new AdminError("This account is suspended. Reactivate it first.");
  if (!user.password) throw new AdminError("This account signs in with Google and has no password to reset.");

  await requestPasswordReset(user.email);
  await recordAuditLog({
    actorId: actor.id,
    action: "user.password_reset_initiated",
    entityType: "User",
    entityId: userId,
    ipAddress: actor.ipAddress,
    metadata: { reason: reason.reason },
  });
}
