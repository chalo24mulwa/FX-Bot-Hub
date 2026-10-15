import type { AdminRole } from "@prisma/client";
import { db } from "@/lib/db";
import { evaluateAdminRoleGrant, requireReason } from "@/lib/admin/rules";
import { ADMIN_ROLE_LABELS } from "@/lib/authorization/permissions";
import { AdminError, type AdminActor } from "./core";

export const ALL_ADMIN_ROLES: AdminRole[] = ["USER_SUPPORT", "LISTING_MODERATOR", "PARTNERSHIP_MANAGER", "FINANCE", "CONTENT"];

function assertKnownRole(role: string): asserts role is AdminRole {
  if (!(ALL_ADMIN_ROLES as string[]).includes(role)) throw new AdminError("Unknown admin role.");
}

/**
 * Grants a granular admin role. A non-staff account is made a MODERATOR in the
 * same transaction (the base staff rank the grant attaches to) and that is
 * audited as its own entry. The acting Super Administrator is re-read from the
 * database — the permission is never taken from the request.
 */
export async function grantAdminRole(actor: AdminActor, userId: string, role: string, rawReason: unknown) {
  assertKnownRole(role);
  const reason = requireReason(rawReason);
  if (!reason.ok) throw new AdminError(reason.error);

  await db.$transaction(async (tx) => {
    const [actorRow, target, existing] = await Promise.all([
      tx.user.findUnique({ where: { id: actor.id }, select: { id: true, role: true, bannedAt: true } }),
      tx.user.findUnique({ where: { id: userId }, select: { id: true, role: true, bannedAt: true } }),
      tx.adminRoleGrant.findUnique({ where: { userId_role: { userId, role } } }),
    ]);
    if (!actorRow || actorRow.bannedAt) throw new AdminError("Your account can't do that.", 403);
    if (!target) throw new AdminError("That member wasn't found.", 404);

    const decision = evaluateAdminRoleGrant({ actor: actorRow, target, hasGrant: Boolean(existing), op: "grant" });
    if (!decision.ok) throw new AdminError(decision.error, 403);

    if (decision.promoteTo) {
      await tx.user.update({ where: { id: userId }, data: { role: decision.promoteTo } });
      await tx.auditLog.create({
        data: {
          actorId: actor.id,
          action: "user.role_change",
          entityType: "User",
          entityId: userId,
          ipAddress: actor.ipAddress,
          metadata: { from: target.role, to: decision.promoteTo, reason: `Needed to hold the ${ADMIN_ROLE_LABELS[role]} role. ${reason.reason}`, viaAdminRole: role },
        },
      });
    }
    await tx.adminRoleGrant.create({ data: { userId, role, grantedById: actor.id, reason: reason.reason } });
    await tx.auditLog.create({
      data: {
        actorId: actor.id,
        action: "admin_role.grant",
        entityType: "User",
        entityId: userId,
        ipAddress: actor.ipAddress,
        metadata: { role, reason: reason.reason, promoted: Boolean(decision.promoteTo) },
      },
    });
  });
}

/**
 * Revokes a role. Taking away someone's *last* admin role also removes their
 * staff rank: otherwise a scoped moderator would silently become a full
 * all-purpose moderator the moment their scope was lifted — revoking must never
 * widen access.
 */
export async function revokeAdminRole(actor: AdminActor, userId: string, role: string, rawReason: unknown) {
  assertKnownRole(role);
  const reason = requireReason(rawReason);
  if (!reason.ok) throw new AdminError(reason.error);

  await db.$transaction(async (tx) => {
    const [actorRow, target, existing, remaining] = await Promise.all([
      tx.user.findUnique({ where: { id: actor.id }, select: { id: true, role: true, bannedAt: true } }),
      tx.user.findUnique({ where: { id: userId }, select: { id: true, role: true, bannedAt: true, sellerProfile: { select: { userId: true } } } }),
      tx.adminRoleGrant.findUnique({ where: { userId_role: { userId, role } } }),
      tx.adminRoleGrant.count({ where: { userId, NOT: { role } } }),
    ]);
    if (!actorRow || actorRow.bannedAt) throw new AdminError("Your account can't do that.", 403);
    if (!target) throw new AdminError("That member wasn't found.", 404);

    const decision = evaluateAdminRoleGrant({ actor: actorRow, target, hasGrant: Boolean(existing), op: "revoke" });
    if (!decision.ok) throw new AdminError(decision.error, 403);

    await tx.adminRoleGrant.delete({ where: { userId_role: { userId, role } } });
    let demotedTo: string | null = null;
    if (remaining === 0 && target.role === "MODERATOR") {
      demotedTo = target.sellerProfile ? "SELLER" : "USER";
      await tx.user.update({ where: { id: userId }, data: { role: demotedTo as "SELLER" | "USER" } });
    }
    await tx.auditLog.create({
      data: {
        actorId: actor.id,
        action: "admin_role.revoke",
        entityType: "User",
        entityId: userId,
        ipAddress: actor.ipAddress,
        metadata: { role, reason: reason.reason, staffRankRemoved: demotedTo },
      },
    });
  });
}

export async function listAdminRoleHolders() {
  const rows = await db.adminRoleGrant.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      user: { select: { id: true, name: true, email: true, role: true, bannedAt: true } },
      grantedBy: { select: { name: true, email: true } },
    },
  });
  const byUser = new Map<string, { user: (typeof rows)[number]["user"]; grants: { role: AdminRole; at: Date; by: string | null; reason: string | null }[] }>();
  for (const row of rows) {
    const entry = byUser.get(row.userId) ?? { user: row.user, grants: [] };
    entry.grants.push({ role: row.role, at: row.createdAt, by: row.grantedBy?.name ?? row.grantedBy?.email ?? null, reason: row.reason });
    byUser.set(row.userId, entry);
  }
  return [...byUser.values()];
}

/** Everyone with an admin-level base role, for the "who can do what" overview. */
export async function listStaffSummary() {
  return db.user.findMany({
    where: { role: { in: ["ADMIN", "SUPER_ADMIN"] } },
    orderBy: [{ role: "desc" }, { createdAt: "asc" }],
    select: { id: true, name: true, email: true, role: true, bannedAt: true },
  });
}
