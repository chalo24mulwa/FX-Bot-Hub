import type { AdminRole, UserRole } from "@prisma/client";
import { isAdmin, isStaff, isSeller } from "./roles";

export type Action =
  | "product:create"
  | "product:edit_own"
  | "product:edit_any"
  | "product:moderate" // approve / reject / suspend / feature
  | "product:delete_any"
  | "review:delete_any"
  | "user:view_all"
  | "user:manage_roles"
  | "user:suspend"
  | "user:edit" // edit a member's profile details
  | "user:reset_password" // send a member a password-reset link
  | "user:impersonate" // start a "view as user" session
  | "admin_role:manage" // grant / revoke the granular admin roles (Super Administrator only)
  | "seller:view_dashboard"
  | "admin:view_dashboard"
  | "admin:view_audit_log"
  | "admin:manage_settings"
  | "category:manage"
  | "calendar:manage"
  | "news:manage"
  | "broker:manage" // the Best Brokers listings (create/edit/rank/publish/archive/delete)
  | "signal:moderate"
  | "data_source:manage"
  | "refund:manage"
  | "payout:manage"
  | "license:manage"
  | "finance:view"
  | "security:view"
  | "queue:view"
  | "community:moderate" // hide/remove/lock/pin/feature content, review reports, restrict members
  | "community:manage_categories"
  | "partnership:manage" // Partner/Master Partner decisions, commissions, payouts, programme settings
  | "partnership:create_account"; // create/activate a Partner profile for an existing member

/**
 * Who is asking. A bare `UserRole` still works everywhere (existing call sites
 * pass one); pass the whole subject — `session.user` has this shape — so the
 * granular admin roles can be honoured.
 */
export interface PermissionSubject {
  role: UserRole;
  adminRoles?: readonly AdminRole[];
}

/**
 * Centralized capability matrix — the single source of truth for "who can
 * do what." Route handlers, server actions, and UI (to hide/disable
 * controls) all call `can()` instead of comparing `role === "ADMIN"`
 * inline, so a policy change happens in exactly one place.
 *
 * This is the base matrix, keyed by `UserRole`. It is unchanged for every
 * action that existed before the admin control centre.
 */
const PERMISSIONS: Record<Action, (role: UserRole) => boolean> = {
  "product:create": isSeller,
  "product:edit_own": isSeller,
  "product:edit_any": isStaff,
  "product:moderate": isStaff,
  "product:delete_any": isAdmin,
  "review:delete_any": isStaff,
  "user:view_all": isStaff,
  "user:manage_roles": isAdmin,
  "user:suspend": isStaff,
  "user:edit": isAdmin,
  "user:reset_password": isAdmin,
  "user:impersonate": isAdmin,
  "admin_role:manage": (role) => role === "SUPER_ADMIN",
  "seller:view_dashboard": isSeller,
  "admin:view_dashboard": isStaff,
  "admin:view_audit_log": isStaff,
  "admin:manage_settings": isAdmin,
  "category:manage": isAdmin,
  "calendar:manage": isStaff,
  "news:manage": isStaff,
  // Commercial content (affiliate links, rankings), so admins only — a legacy moderator doesn't get it.
  "broker:manage": isAdmin,
  "signal:moderate": isStaff,
  "data_source:manage": isAdmin,
  "refund:manage": isStaff,
  "payout:manage": isAdmin,
  "license:manage": isStaff,
  "finance:view": isAdmin,
  "security:view": isAdmin,
  "queue:view": isAdmin,
  "community:moderate": isStaff,
  "community:manage_categories": isStaff,
  // Financial (commissions and payouts), so admins only — same as payout:manage.
  "partnership:manage": isAdmin,
  "partnership:create_account": isAdmin,
};

/**
 * What each granular admin role may do. A MODERATOR who holds one or more of
 * these is *scoped*: they get exactly the union of their roles' capabilities
 * (plus the admin dashboard) instead of the legacy all-purpose moderator set.
 * A MODERATOR with no grants keeps today's behaviour, so nobody loses access
 * until a Super Administrator deliberately scopes them. ADMIN and SUPER_ADMIN
 * are never narrowed by grants.
 */
export const ADMIN_ROLE_CAPABILITIES: Record<AdminRole, readonly Action[]> = {
  USER_SUPPORT: ["admin:view_dashboard", "user:view_all", "user:edit", "user:suspend", "user:reset_password", "user:impersonate"],
  LISTING_MODERATOR: ["admin:view_dashboard", "product:moderate", "product:edit_any", "review:delete_any"],
  PARTNERSHIP_MANAGER: ["admin:view_dashboard", "user:view_all", "partnership:manage", "partnership:create_account"],
  FINANCE: ["admin:view_dashboard", "finance:view", "payout:manage", "refund:manage"],
  CONTENT: ["admin:view_dashboard", "news:manage", "calendar:manage", "broker:manage"],
};

export const ADMIN_ROLE_LABELS: Record<AdminRole, string> = {
  USER_SUPPORT: "User Support Administrator",
  LISTING_MODERATOR: "Listing Moderator",
  PARTNERSHIP_MANAGER: "Partnership Manager",
  FINANCE: "Finance Administrator",
  CONTENT: "Content Administrator",
};

/** Actions about the member's own selling — never narrowed by admin-role scoping. */
const SELLING_ACTIONS: readonly Action[] = ["product:create", "product:edit_own", "seller:view_dashboard"];

function toSubject(subject: UserRole | PermissionSubject): Required<PermissionSubject> {
  return typeof subject === "string" ? { role: subject, adminRoles: [] } : { role: subject.role, adminRoles: subject.adminRoles ?? [] };
}

/** True for a MODERATOR whose access has been narrowed to specific admin roles. */
export function isScopedStaff(subject: UserRole | PermissionSubject): boolean {
  const s = toSubject(subject);
  return s.role === "MODERATOR" && s.adminRoles.length > 0;
}

export function can(subject: UserRole | PermissionSubject, action: Action): boolean {
  const s = toSubject(subject);
  if (isScopedStaff(s) && !SELLING_ACTIONS.includes(action)) {
    return s.adminRoles.some((role) => ADMIN_ROLE_CAPABILITIES[role].includes(action));
  }
  return PERMISSIONS[action](s.role);
}

/** Ownership-aware check for actions scoped to "your own" resource. */
export function canEditProduct(subject: UserRole | PermissionSubject, isOwner: boolean): boolean {
  if (can(subject, "product:edit_any")) return true;
  return isOwner && can(subject, "product:edit_own");
}
