import type { AdminRole, UserRole } from "@prisma/client";
import { can, type PermissionSubject } from "@/lib/authorization/permissions";
import { isStaff, roleRank } from "@/lib/authorization/roles";

// Pure decision rules for the admin control centre — no database, no framework.
// The services in src/features/admin/ load the facts, ask these functions, and
// only then write. Every rule returns a reason a person can read.

export type Decision = { ok: true } | { ok: false; error: string };
const allow: Decision = { ok: true };
const deny = (error: string): Decision => ({ ok: false, error });

export interface Actor {
  id: string;
  role: UserRole;
  adminRoles?: readonly AdminRole[];
}

export interface Target {
  id: string;
  role: UserRole;
  bannedAt?: Date | null;
}

// ---------------------------------------------------------------------------
// Account roles and suspension
// ---------------------------------------------------------------------------

/**
 * A staff member may only act on someone they strictly outrank; a Super
 * Administrator may act on anyone but themselves. Nobody may change their own
 * role or suspend themselves — that is how privileges get escalated or an
 * administrator locks the site out of its own admin area.
 */
export function canActOnAccount(actor: Actor, target: Target): Decision {
  if (actor.id === target.id) return deny("You can't do that to your own account.");
  if (actor.role === "SUPER_ADMIN") return allow;
  if (roleRank(actor.role) <= roleRank(target.role)) return deny("You can only manage accounts with a lower role than yours.");
  return allow;
}

export function evaluateRoleChange(input: {
  actor: Actor;
  target: Target;
  newRole: UserRole;
  /** Active (not suspended) Super Administrators right now. */
  activeSuperAdmins: number;
}): Decision {
  const { actor, target, newRole, activeSuperAdmins } = input;
  const base = canActOnAccount(actor, target);
  if (!base.ok) return base;
  if (newRole === target.role) return deny("That account already has this role.");

  // Only a Super Administrator can hand out or take away ADMIN / SUPER_ADMIN.
  if (actor.role !== "SUPER_ADMIN" && roleRank(newRole) >= roleRank(actor.role)) {
    return deny("You can only assign roles lower than your own.");
  }
  if (actor.role !== "SUPER_ADMIN" && roleRank(target.role) >= roleRank("ADMIN")) {
    return deny("Only a Super Administrator can change an administrator's role.");
  }
  if (target.role === "SUPER_ADMIN" && newRole !== "SUPER_ADMIN" && !target.bannedAt && activeSuperAdmins <= 1) {
    return deny("This is the last active Super Administrator. Make someone else a Super Administrator first.");
  }
  return allow;
}

export function evaluateSuspension(input: { actor: Actor; target: Target; suspending: boolean; activeSuperAdmins: number }): Decision {
  const { actor, target, suspending, activeSuperAdmins } = input;
  const base = canActOnAccount(actor, target);
  if (!base.ok) return base;
  if (suspending && target.bannedAt) return deny("This account is already suspended.");
  if (!suspending && !target.bannedAt) return deny("This account isn't suspended.");
  if (suspending && target.role === "SUPER_ADMIN" && activeSuperAdmins <= 1) {
    return deny("This is the last active Super Administrator and can't be suspended.");
  }
  return allow;
}

// ---------------------------------------------------------------------------
// Granular admin roles
// ---------------------------------------------------------------------------

/**
 * Granting needs a staff account to attach the role to. `promoteTo` says the
 * account must first be made a MODERATOR (the base staff rank) — the service
 * does that in the same transaction and records it.
 */
export function evaluateAdminRoleGrant(input: { actor: Actor; target: Target; hasGrant: boolean; op: "grant" | "revoke" }): Decision & { promoteTo?: "MODERATOR" } {
  const { actor, target, hasGrant, op } = input;
  if (!can(actor, "admin_role:manage")) return deny("Only a Super Administrator can manage admin roles.");
  if (actor.id === target.id) return deny("You can't change your own admin roles.");
  if (target.bannedAt) return deny("This account is suspended.");
  if (roleRank(target.role) >= roleRank("ADMIN")) {
    return deny("Administrators already have broad access; admin roles are for moderator-level staff.");
  }
  if (op === "grant") {
    if (hasGrant) return deny("This account already has that admin role.");
    return isStaff(target.role) ? allow : { ok: true, promoteTo: "MODERATOR" };
  }
  return hasGrant ? allow : deny("This account doesn't have that admin role.");
}

// ---------------------------------------------------------------------------
// "View as user"
// ---------------------------------------------------------------------------

export const IMPERSONATION_MAX_MINUTES = 60;
export const IMPERSONATION_REASON_MAX = 500;

export function impersonationExpiry(now: Date): Date {
  return new Date(now.getTime() + IMPERSONATION_MAX_MINUTES * 60_000);
}

export function isImpersonationExpired(expiresAt: Date | number, now: Date | number = Date.now()): boolean {
  const exp = typeof expiresAt === "number" ? expiresAt : expiresAt.getTime();
  const at = typeof now === "number" ? now : now.getTime();
  return at >= exp;
}

export function evaluateImpersonation(input: {
  actor: Actor & PermissionSubject & { bannedAt?: Date | null; mustChangePassword?: boolean };
  target: Target;
  alreadyImpersonating: boolean;
}): Decision {
  const { actor, target, alreadyImpersonating } = input;
  if (alreadyImpersonating) return deny("Exit the current session before starting another.");
  if (!can(actor, "user:impersonate")) return deny("You don't have permission to access member accounts.");
  if (actor.bannedAt) return deny("Your account is suspended.");
  if (actor.mustChangePassword) return deny("Change your temporary password before using this.");
  if (actor.id === target.id) return deny("You're already signed in as this account.");
  // Staff accounts are never reachable this way — otherwise one administrator
  // could act as another (or as a Super Administrator) and the audit trail would
  // blame the wrong person. Use the dedicated admin tools for staff.
  if (isStaff(target.role)) return deny("Staff accounts can't be accessed this way.");
  if (target.bannedAt) return deny("This account is suspended. Reactivate it first.");
  return allow;
}

// ---------------------------------------------------------------------------
// Input hygiene shared by the admin services
// ---------------------------------------------------------------------------

export function cleanReason(value: unknown, max = 500): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

export function requireReason(value: unknown, min = 5, max = 500): { ok: true; reason: string } | { ok: false; error: string } {
  const reason = cleanReason(value, max);
  return reason.length >= min ? { ok: true, reason } : { ok: false, error: `Please give a reason (at least ${min} characters) — it's kept in the audit log.` };
}
