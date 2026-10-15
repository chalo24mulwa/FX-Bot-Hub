import type { AdminRole, UserRole } from "@prisma/client";
import type { JWT } from "next-auth/jwt";
import { db } from "@/lib/db";
import { evaluateImpersonation, isImpersonationExpired } from "@/lib/admin/rules";
import { isStaff } from "@/lib/authorization/roles";
import { recordAuditLog } from "@/repositories/audit-log-repository";

// How a "view as user" session is carried in the Auth.js JWT.
//
// The cookie only ever holds the impersonation *session id* (`impSid`) plus the
// display name for the banner and the expiry. The administrator's identity is
// kept in the ImpersonationSession row, never trusted from the browser, and the
// token's `id`/`role` are switched to the *target's*, so every existing
// permission check naturally sees an ordinary member — admin-only pages and
// actions stay closed. Each function here re-derives its facts from the
// database; a client that posts a made-up `session` payload to
// /api/auth/session can at worst start or end a session that already exists for
// its own account.

export const IMP_KEYS = ["impSid", "impAdminId", "impExp", "impName"] as const;

export type EndReason = "exited" | "expired" | "signed_out" | "revoked" | "target_unavailable";

/** Granular admin roles only matter for moderator-level staff, so only load them for those. */
export async function loadAdminRoles(userId: string, role: UserRole): Promise<AdminRole[]> {
  if (role !== "MODERATOR") return [];
  try {
    const rows = await db.adminRoleGrant.findMany({ where: { userId }, select: { role: true } });
    return rows.map((r) => r.role);
  } catch {
    // Never let a problem here stop anyone signing in — no grants means least privilege.
    return [];
  }
}

export function isImpersonating(token: JWT): boolean {
  return typeof token.impSid === "string";
}

function withoutImpersonation(token: JWT): JWT {
  const copy: JWT = { ...token };
  for (const key of IMP_KEYS) delete copy[key];
  return copy;
}

/** Switches the token to the target — only for a session row created for *this* administrator. */
export async function beginImpersonationToken(token: JWT, sessionId: string): Promise<JWT> {
  if (isImpersonating(token) || typeof token.id !== "string") return token;

  const row = await db.impersonationSession.findUnique({
    where: { id: sessionId },
    include: {
      admin: { select: { id: true, role: true, bannedAt: true, mustChangePassword: true } },
      target: { select: { id: true, name: true, email: true, image: true, role: true, bannedAt: true } },
    },
  });
  if (!row || row.adminId !== token.id || row.endedAt || isImpersonationExpired(row.expiresAt)) return token;

  const adminRoles = await loadAdminRoles(row.admin.id, row.admin.role);
  const decision = evaluateImpersonation({
    actor: { ...row.admin, adminRoles },
    target: row.target,
    alreadyImpersonating: false,
  });
  if (!decision.ok) return token;

  return {
    ...token,
    id: row.target.id,
    sub: row.target.id,
    name: row.target.name,
    email: row.target.email,
    picture: row.target.image,
    role: row.target.role,
    adminRoles: [],
    impSid: row.id,
    impAdminId: row.adminId,
    impExp: row.expiresAt.getTime(),
    impName: row.target.name ?? row.target.email,
    roleCheckedAt: Date.now(),
  };
}

/**
 * Closes the session row and puts the administrator's own identity back in the
 * token. Returns null (ending the sign-in) if that administrator can no longer
 * be restored — suspended, deleted or no longer staff.
 */
export async function endImpersonationToken(token: JWT, reason: EndReason): Promise<JWT | null> {
  const sessionId = typeof token.impSid === "string" ? token.impSid : null;
  const adminId = typeof token.impAdminId === "string" ? token.impAdminId : null;
  if (!sessionId || !adminId) return token;

  const closed = await db.impersonationSession.updateMany({
    where: { id: sessionId, endedAt: null },
    data: { endedAt: new Date(), endReason: reason },
  });
  if (closed.count > 0) {
    await recordAuditLog({
      actorId: adminId,
      action: "impersonation.end",
      entityType: "User",
      entityId: typeof token.id === "string" ? token.id : undefined,
      impersonationSessionId: sessionId,
      metadata: { reason },
    }).catch(() => undefined);
  }

  const admin = await db.user.findUnique({ where: { id: adminId }, select: { id: true, name: true, email: true, image: true, role: true, bannedAt: true } });
  if (!admin || admin.bannedAt || !isStaff(admin.role)) return null;

  return {
    ...withoutImpersonation(token),
    id: admin.id,
    sub: admin.id,
    name: admin.name,
    email: admin.email,
    picture: admin.image,
    role: admin.role,
    adminRoles: await loadAdminRoles(admin.id, admin.role),
    roleCheckedAt: Date.now(),
  };
}

/** Is the session this token points at still open? Used on the periodic re-check. */
export async function impersonationStillValid(token: JWT): Promise<{ valid: true } | { valid: false; reason: EndReason }> {
  if (typeof token.impSid !== "string") return { valid: true };
  const row = await db.impersonationSession.findUnique({ where: { id: token.impSid }, select: { endedAt: true, expiresAt: true, endReason: true } });
  if (!row || row.endedAt) return { valid: false, reason: "revoked" };
  if (isImpersonationExpired(row.expiresAt)) return { valid: false, reason: "expired" };
  return { valid: true };
}

/** Marks the session closed when someone signs out in the middle of it. */
export async function closeImpersonationOnSignOut(token: JWT | null | undefined): Promise<void> {
  if (!token || typeof token.impSid !== "string" || typeof token.impAdminId !== "string") return;
  const closed = await db.impersonationSession.updateMany({
    where: { id: token.impSid, endedAt: null },
    data: { endedAt: new Date(), endReason: "signed_out" },
  });
  if (closed.count > 0) {
    await recordAuditLog({
      actorId: token.impAdminId,
      action: "impersonation.end",
      entityType: "User",
      entityId: typeof token.id === "string" ? token.id : undefined,
      impersonationSessionId: token.impSid,
      metadata: { reason: "signed_out" },
    }).catch(() => undefined);
  }
}
