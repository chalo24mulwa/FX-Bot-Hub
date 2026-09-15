import type { UserRole } from "@prisma/client";
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
  | "seller:view_dashboard"
  | "admin:view_dashboard"
  | "admin:view_audit_log"
  | "admin:manage_settings"
  | "category:manage"
  | "calendar:manage"
  | "news:manage"
  | "signal:moderate"
  | "data_source:manage";

/**
 * Centralized capability matrix — the single source of truth for "who can
 * do what." Route handlers, server actions, and UI (to hide/disable
 * controls) all call `can()` instead of comparing `role === "ADMIN"`
 * inline, so a policy change happens in exactly one place.
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
  "seller:view_dashboard": isSeller,
  "admin:view_dashboard": isStaff,
  "admin:view_audit_log": isStaff,
  "admin:manage_settings": isAdmin,
  "category:manage": isAdmin,
  "calendar:manage": isStaff,
  "news:manage": isStaff,
  "signal:moderate": isStaff,
  "data_source:manage": isAdmin,
};

export function can(role: UserRole, action: Action): boolean {
  return PERMISSIONS[action](role);
}

/** Ownership-aware check for actions scoped to "your own" resource. */
export function canEditProduct(role: UserRole, isOwner: boolean): boolean {
  if (can(role, "product:edit_any")) return true;
  return isOwner && can(role, "product:edit_own");
}
