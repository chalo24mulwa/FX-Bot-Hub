import type { Action } from "@/lib/authorization/permissions";

/**
 * Which capability each /admin area needs. The admin layout and proxy only
 * check "is staff"; before this map, areas like /admin/finance were readable by
 * any moderator even though `finance:view` is an admin-only action. The proxy
 * (and sensitive pages) now enforce this, so the page gate matches the action
 * gate. Longest prefix wins; areas not listed here are open to any staff member
 * (as before) — the dashboard, and those with their own gate (community).
 */
const ADMIN_ROUTE_ACTIONS: ReadonlyArray<readonly [string, Action]> = [
  ["/admin/users", "user:view_all"],
  ["/admin/access-sessions", "user:impersonate"],
  ["/admin/admin-roles", "admin_role:manage"],
  ["/admin/products", "product:moderate"],
  ["/admin/reviews", "review:delete_any"],
  ["/admin/categories", "category:manage"],
  ["/admin/calendar", "calendar:manage"],
  ["/admin/news-categories", "news:manage"],
  ["/admin/news", "news:manage"],
  ["/admin/signal-providers", "signal:moderate"],
  ["/admin/signals", "signal:moderate"],
  ["/admin/data-sources", "data_source:manage"],
  ["/admin/finance", "finance:view"],
  ["/admin/refunds", "refund:manage"],
  ["/admin/payouts", "payout:manage"],
  ["/admin/partnership", "partnership:manage"],
  ["/admin/licenses", "license:manage"],
  ["/admin/security", "security:view"],
  ["/admin/queues", "queue:view"],
  ["/admin/settings", "admin:manage_settings"],
  ["/admin/audit-logs", "admin:view_audit_log"],
];

export function requiredActionForAdminPath(pathname: string): Action | null {
  const path = pathname.replace(/\/+$/, "") || "/";
  let best: readonly [string, Action] | null = null;
  for (const entry of ADMIN_ROUTE_ACTIONS) {
    const [prefix] = entry;
    if ((path === prefix || path.startsWith(prefix + "/")) && (!best || prefix.length > best[0].length)) best = entry;
  }
  return best ? best[1] : null;
}
