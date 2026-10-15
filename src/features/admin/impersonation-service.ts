import { db } from "@/lib/db";
import { cleanReason, evaluateImpersonation, impersonationExpiry, IMPERSONATION_REASON_MAX } from "@/lib/admin/rules";
import { recordAuditLog } from "@/repositories/audit-log-repository";
import { loadAdminRoles } from "./impersonation-token";
import { AdminError, type AdminActor } from "./core";

/**
 * Creates the server-side record of a "view as user" session after every check
 * passes. It does not switch anyone's sign-in — the action does that afterwards
 * with update(), and the jwt callback re-verifies this row before switching.
 */
export async function createImpersonationSession(actor: AdminActor, targetUserId: string, rawReason: unknown) {
  const reason = cleanReason(rawReason, IMPERSONATION_REASON_MAX);

  const [admin, target] = await Promise.all([
    db.user.findUnique({ where: { id: actor.id }, select: { id: true, role: true, bannedAt: true, mustChangePassword: true } }),
    db.user.findUnique({ where: { id: targetUserId }, select: { id: true, name: true, email: true, role: true, bannedAt: true } }),
  ]);
  if (!admin) throw new AdminError("Your account couldn't be found.", 403);
  if (!target) throw new AdminError("That member wasn't found.", 404);

  // Facts come from the database, not from the session the request arrived with.
  const adminRoles = await loadAdminRoles(admin.id, admin.role);
  const decision = evaluateImpersonation({ actor: { ...admin, adminRoles }, target, alreadyImpersonating: false });
  if (!decision.ok) throw new AdminError(decision.error, 403);

  const now = new Date();
  const row = await db.impersonationSession.create({
    data: {
      adminId: admin.id,
      targetUserId: target.id,
      reason: reason || null,
      expiresAt: impersonationExpiry(now),
      ipAddress: actor.ipAddress ?? null,
    },
  });
  await recordAuditLog({
    actorId: admin.id,
    action: "impersonation.start",
    entityType: "User",
    entityId: target.id,
    impersonationSessionId: row.id,
    ipAddress: actor.ipAddress,
    metadata: { reason: reason || null, expiresAt: row.expiresAt.toISOString(), targetRole: target.role },
  });
  return { session: row, target };
}

/** An administrator ends someone's open session (theirs or a colleague's); it takes effect within a minute. */
export async function revokeImpersonationSession(actor: AdminActor, sessionId: string) {
  const row = await db.impersonationSession.findUnique({ where: { id: sessionId } });
  if (!row) throw new AdminError("Session not found.", 404);
  if (row.endedAt) throw new AdminError("That session has already ended.", 409);
  // Anyone allowed to start sessions can end their own; a Super Administrator can end anyone's.
  if (row.adminId !== actor.id && actor.role !== "SUPER_ADMIN") throw new AdminError("You can only end your own sessions.", 403);
  const closed = await db.impersonationSession.updateMany({
    where: { id: sessionId, endedAt: null },
    data: { endedAt: new Date(), endReason: "revoked" },
  });
  if (closed.count === 0) throw new AdminError("That session has already ended.", 409);
  await recordAuditLog({
    actorId: actor.id,
    action: "impersonation.revoke",
    entityType: "User",
    entityId: row.targetUserId,
    impersonationSessionId: sessionId,
    ipAddress: actor.ipAddress,
    metadata: { startedBy: row.adminId },
  });
}

export async function listImpersonationSessions(options: { page: number; pageSize: number; activeOnly?: boolean }) {
  const now = new Date();
  const where = options.activeOnly ? { endedAt: null, expiresAt: { gt: now } } : {};
  const [items, total] = await Promise.all([
    db.impersonationSession.findMany({
      where,
      orderBy: { startedAt: "desc" },
      skip: (options.page - 1) * options.pageSize,
      take: options.pageSize,
      include: {
        admin: { select: { id: true, name: true, email: true } },
        target: { select: { id: true, name: true, email: true } },
      },
    }),
    db.impersonationSession.count({ where }),
  ]);
  return { items, total };
}

/** How a session ended, derived: an open row past its expiry simply ran out. */
export function sessionState(row: { endedAt: Date | null; endReason: string | null; expiresAt: Date }, now = new Date()): { label: string; active: boolean } {
  if (row.endedAt) return { label: `Ended — ${(row.endReason ?? "ended").replace(/_/g, " ")}`, active: false };
  if (row.expiresAt <= now) return { label: "Expired", active: false };
  return { label: "Active", active: true };
}
