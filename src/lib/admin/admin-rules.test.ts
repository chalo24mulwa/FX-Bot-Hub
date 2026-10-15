import { describe, expect, it } from "vitest";
import {
  canActOnAccount,
  cleanReason,
  evaluateAdminRoleGrant,
  evaluateImpersonation,
  evaluateRoleChange,
  evaluateSuspension,
  impersonationExpiry,
  isImpersonationExpired,
  requireReason,
  IMPERSONATION_MAX_MINUTES,
  type Actor,
  type Target,
} from "./rules";
import { isReservedEmail, reservedEmails } from "./reserved-emails";
import { requiredActionForAdminPath } from "./route-permissions";
import { can, isScopedStaff } from "@/lib/authorization/permissions";

const actor = (role: Actor["role"], extra: Partial<Actor> = {}): Actor => ({ id: "actor", role, ...extra });
const target = (role: Target["role"], extra: Partial<Target> = {}): Target => ({ id: "target", role, ...extra });

describe("canActOnAccount", () => {
  it("never lets anyone act on their own account", () => {
    expect(canActOnAccount(actor("SUPER_ADMIN"), { id: "actor", role: "SUPER_ADMIN" }).ok).toBe(false);
  });
  it("requires staff to strictly outrank the target", () => {
    expect(canActOnAccount(actor("MODERATOR"), target("ADMIN")).ok).toBe(false);
    expect(canActOnAccount(actor("ADMIN"), target("ADMIN")).ok).toBe(false);
    expect(canActOnAccount(actor("ADMIN"), target("MODERATOR")).ok).toBe(true);
  });
  it("lets a Super Administrator act on anyone else", () => {
    expect(canActOnAccount(actor("SUPER_ADMIN"), target("SUPER_ADMIN")).ok).toBe(true);
  });
});

describe("evaluateRoleChange — the privilege-escalation holes", () => {
  const base = { activeSuperAdmins: 3 };
  it("stops an ADMIN promoting someone (or themselves) to SUPER_ADMIN", () => {
    expect(evaluateRoleChange({ ...base, actor: actor("ADMIN"), target: target("USER"), newRole: "SUPER_ADMIN" }).ok).toBe(false);
    expect(evaluateRoleChange({ ...base, actor: actor("ADMIN"), target: { id: "actor", role: "ADMIN" }, newRole: "SUPER_ADMIN" }).ok).toBe(false);
  });
  it("stops an ADMIN creating another ADMIN or changing an ADMIN's role", () => {
    expect(evaluateRoleChange({ ...base, actor: actor("ADMIN"), target: target("USER"), newRole: "ADMIN" }).ok).toBe(false);
    expect(evaluateRoleChange({ ...base, actor: actor("ADMIN"), target: target("ADMIN"), newRole: "USER" }).ok).toBe(false);
  });
  it("lets an ADMIN assign roles below their own", () => {
    expect(evaluateRoleChange({ ...base, actor: actor("ADMIN"), target: target("USER"), newRole: "MODERATOR" }).ok).toBe(true);
  });
  it("lets a Super Administrator assign any role to someone else", () => {
    expect(evaluateRoleChange({ ...base, actor: actor("SUPER_ADMIN"), target: target("USER"), newRole: "ADMIN" }).ok).toBe(true);
    expect(evaluateRoleChange({ ...base, actor: actor("SUPER_ADMIN"), target: target("USER"), newRole: "SUPER_ADMIN" }).ok).toBe(true);
  });
  it("blocks self-demotion and a no-op change", () => {
    expect(evaluateRoleChange({ ...base, actor: actor("SUPER_ADMIN"), target: { id: "actor", role: "SUPER_ADMIN" }, newRole: "USER" }).ok).toBe(false);
    expect(evaluateRoleChange({ ...base, actor: actor("SUPER_ADMIN"), target: target("USER"), newRole: "USER" }).ok).toBe(false);
  });
  it("protects the last active Super Administrator", () => {
    const last = evaluateRoleChange({ actor: actor("SUPER_ADMIN"), target: target("SUPER_ADMIN"), newRole: "ADMIN", activeSuperAdmins: 1 });
    expect(last.ok).toBe(false);
    expect(!last.ok && last.error).toMatch(/last active Super Administrator/);
    expect(evaluateRoleChange({ actor: actor("SUPER_ADMIN"), target: target("SUPER_ADMIN"), newRole: "ADMIN", activeSuperAdmins: 2 }).ok).toBe(true);
  });
});

describe("evaluateSuspension", () => {
  it("stops a moderator suspending an administrator", () => {
    expect(evaluateSuspension({ actor: actor("MODERATOR"), target: target("ADMIN"), suspending: true, activeSuperAdmins: 2 }).ok).toBe(false);
  });
  it("won't suspend the last Super Administrator", () => {
    expect(evaluateSuspension({ actor: actor("SUPER_ADMIN"), target: target("SUPER_ADMIN"), suspending: true, activeSuperAdmins: 1 }).ok).toBe(false);
  });
  it("rejects redundant changes", () => {
    expect(evaluateSuspension({ actor: actor("ADMIN"), target: target("USER", { bannedAt: new Date() }), suspending: true, activeSuperAdmins: 2 }).ok).toBe(false);
    expect(evaluateSuspension({ actor: actor("ADMIN"), target: target("USER"), suspending: false, activeSuperAdmins: 2 }).ok).toBe(false);
  });
  it("allows the normal case in both directions", () => {
    expect(evaluateSuspension({ actor: actor("ADMIN"), target: target("USER"), suspending: true, activeSuperAdmins: 2 }).ok).toBe(true);
    expect(evaluateSuspension({ actor: actor("ADMIN"), target: target("USER", { bannedAt: new Date() }), suspending: false, activeSuperAdmins: 2 }).ok).toBe(true);
  });
});

describe("evaluateAdminRoleGrant", () => {
  it("is Super Administrator only", () => {
    expect(evaluateAdminRoleGrant({ actor: actor("ADMIN"), target: target("MODERATOR"), hasGrant: false, op: "grant" }).ok).toBe(false);
    expect(evaluateAdminRoleGrant({ actor: actor("SUPER_ADMIN"), target: target("MODERATOR"), hasGrant: false, op: "grant" }).ok).toBe(true);
  });
  it("asks to promote a non-staff account to moderator first", () => {
    const d = evaluateAdminRoleGrant({ actor: actor("SUPER_ADMIN"), target: target("USER"), hasGrant: false, op: "grant" });
    expect(d).toMatchObject({ ok: true, promoteTo: "MODERATOR" });
  });
  it("never grants to oneself, a suspended account or an administrator", () => {
    expect(evaluateAdminRoleGrant({ actor: actor("SUPER_ADMIN"), target: { id: "actor", role: "MODERATOR" }, hasGrant: false, op: "grant" }).ok).toBe(false);
    expect(evaluateAdminRoleGrant({ actor: actor("SUPER_ADMIN"), target: target("MODERATOR", { bannedAt: new Date() }), hasGrant: false, op: "grant" }).ok).toBe(false);
    expect(evaluateAdminRoleGrant({ actor: actor("SUPER_ADMIN"), target: target("ADMIN"), hasGrant: false, op: "grant" }).ok).toBe(false);
  });
  it("rejects duplicate grants and revoking what isn't held", () => {
    expect(evaluateAdminRoleGrant({ actor: actor("SUPER_ADMIN"), target: target("MODERATOR"), hasGrant: true, op: "grant" }).ok).toBe(false);
    expect(evaluateAdminRoleGrant({ actor: actor("SUPER_ADMIN"), target: target("MODERATOR"), hasGrant: false, op: "revoke" }).ok).toBe(false);
    expect(evaluateAdminRoleGrant({ actor: actor("SUPER_ADMIN"), target: target("MODERATOR"), hasGrant: true, op: "revoke" }).ok).toBe(true);
  });
});

describe("evaluateImpersonation", () => {
  const admin = { id: "actor", role: "SUPER_ADMIN" as const, adminRoles: [] as never[], bannedAt: null, mustChangePassword: false };
  it("allows an administrator to access an ordinary member", () => {
    expect(evaluateImpersonation({ actor: admin, target: target("USER"), alreadyImpersonating: false }).ok).toBe(true);
    expect(evaluateImpersonation({ actor: admin, target: target("SELLER"), alreadyImpersonating: false }).ok).toBe(true);
  });
  it("never allows staff targets — including Super Administrators", () => {
    for (const role of ["MODERATOR", "ADMIN", "SUPER_ADMIN"] as const) {
      expect(evaluateImpersonation({ actor: admin, target: target(role), alreadyImpersonating: false }).ok).toBe(false);
    }
  });
  it("refuses nesting, self-access and suspended targets", () => {
    expect(evaluateImpersonation({ actor: admin, target: target("USER"), alreadyImpersonating: true }).ok).toBe(false);
    expect(evaluateImpersonation({ actor: admin, target: { id: "actor", role: "USER" }, alreadyImpersonating: false }).ok).toBe(false);
    expect(evaluateImpersonation({ actor: admin, target: target("USER", { bannedAt: new Date() }), alreadyImpersonating: false }).ok).toBe(false);
  });
  it("needs the permission, and a changed temporary password", () => {
    expect(evaluateImpersonation({ actor: { ...admin, role: "USER" }, target: target("USER"), alreadyImpersonating: false }).ok).toBe(false);
    expect(evaluateImpersonation({ actor: { ...admin, role: "MODERATOR" }, target: target("USER"), alreadyImpersonating: false }).ok).toBe(false);
    expect(evaluateImpersonation({ actor: { ...admin, mustChangePassword: true }, target: target("USER"), alreadyImpersonating: false }).ok).toBe(false);
  });
  it("lets a User Support moderator do it, but not a scoped Listing Moderator", () => {
    expect(evaluateImpersonation({ actor: { ...admin, role: "MODERATOR", adminRoles: ["USER_SUPPORT"] }, target: target("USER"), alreadyImpersonating: false }).ok).toBe(true);
    expect(evaluateImpersonation({ actor: { ...admin, role: "MODERATOR", adminRoles: ["LISTING_MODERATOR"] }, target: target("USER"), alreadyImpersonating: false }).ok).toBe(false);
  });
});

describe("impersonation expiry", () => {
  it("expires after the maximum window", () => {
    const start = new Date("2026-10-16T10:00:00Z");
    const exp = impersonationExpiry(start);
    expect(exp.getTime() - start.getTime()).toBe(IMPERSONATION_MAX_MINUTES * 60_000);
    expect(isImpersonationExpired(exp, new Date(exp.getTime() - 1))).toBe(false);
    expect(isImpersonationExpired(exp, exp)).toBe(true);
    expect(isImpersonationExpired(exp.getTime(), exp.getTime() + 5)).toBe(true);
  });
});

describe("reasons", () => {
  it("trims and caps", () => {
    expect(cleanReason("  hello  ")).toBe("hello");
    expect(cleanReason("x".repeat(900), 100)).toHaveLength(100);
    expect(cleanReason(42)).toBe("");
  });
  it("requires a meaningful reason", () => {
    expect(requireReason("no").ok).toBe(false);
    expect(requireReason("   ").ok).toBe(false);
    expect(requireReason("Chargeback review")).toEqual({ ok: true, reason: "Chargeback review" });
  });
});

describe("reserved emails", () => {
  it("always reserves the admin address, case-insensitively", () => {
    expect(isReservedEmail("admin@fxbothub.com")).toBe(true);
    expect(isReservedEmail("  Admin@FxBotHub.com ")).toBe(true);
    expect(isReservedEmail("someone@fxbothub.com")).toBe(false);
  });
  it("adds environment-configured addresses without dropping the default", () => {
    expect(reservedEmails("billing@fxbothub.com, Support@fxbothub.com")).toEqual(["admin@fxbothub.com", "billing@fxbothub.com", "support@fxbothub.com"]);
    expect(isReservedEmail("billing@fxbothub.com", "billing@fxbothub.com")).toBe(true);
  });
});

describe("admin route permissions", () => {
  it("maps areas to the action they need, longest prefix first", () => {
    expect(requiredActionForAdminPath("/admin/finance")).toBe("finance:view");
    expect(requiredActionForAdminPath("/admin/finance/anything")).toBe("finance:view");
    expect(requiredActionForAdminPath("/admin/news-categories")).toBe("news:manage");
    expect(requiredActionForAdminPath("/admin/partnership/commissions")).toBe("partnership:manage");
    expect(requiredActionForAdminPath("/admin/admin-roles")).toBe("admin_role:manage");
    expect(requiredActionForAdminPath("/admin/users/abc/impersonate")).toBe("user:view_all");
  });
  it("leaves the dashboard and self-gated areas open to staff", () => {
    expect(requiredActionForAdminPath("/admin")).toBeNull();
    expect(requiredActionForAdminPath("/admin/")).toBeNull();
    expect(requiredActionForAdminPath("/admin/community/reports")).toBeNull();
  });
  it("does not match on a shared string prefix", () => {
    expect(requiredActionForAdminPath("/admin/financeX")).toBeNull();
  });
});

describe("scoped staff permissions", () => {
  it("keeps a plain moderator's existing access", () => {
    expect(can({ role: "MODERATOR", adminRoles: [] }, "news:manage")).toBe(true);
    expect(can("MODERATOR", "product:moderate")).toBe(true);
    expect(isScopedStaff("MODERATOR")).toBe(false);
  });
  it("narrows a moderator with admin roles to exactly those capabilities", () => {
    const listing = { role: "MODERATOR" as const, adminRoles: ["LISTING_MODERATOR" as const] };
    expect(isScopedStaff(listing)).toBe(true);
    expect(can(listing, "product:moderate")).toBe(true);
    expect(can(listing, "news:manage")).toBe(false);
    expect(can(listing, "user:impersonate")).toBe(false);
    expect(can(listing, "finance:view")).toBe(false);
  });
  it("unions several admin roles", () => {
    const s = { role: "MODERATOR" as const, adminRoles: ["PARTNERSHIP_MANAGER" as const, "FINANCE" as const] };
    expect(can(s, "partnership:manage")).toBe(true);
    expect(can(s, "payout:manage")).toBe(true);
    expect(can(s, "product:moderate")).toBe(false);
  });
  it("never narrows administrators and never widens plain members", () => {
    expect(can({ role: "ADMIN", adminRoles: ["CONTENT"] }, "finance:view")).toBe(true);
    expect(can({ role: "USER", adminRoles: ["USER_SUPPORT"] }, "user:impersonate")).toBe(false);
    expect(can({ role: "SELLER", adminRoles: ["FINANCE"] }, "finance:view")).toBe(false);
  });
  it("keeps selling abilities for a scoped moderator", () => {
    expect(can({ role: "MODERATOR", adminRoles: ["CONTENT"] }, "product:create")).toBe(true);
  });
  it("makes admin-role management Super Administrator only", () => {
    expect(can("SUPER_ADMIN", "admin_role:manage")).toBe(true);
    expect(can("ADMIN", "admin_role:manage")).toBe(false);
  });
  it("gives the new admin-only actions to ADMIN and SUPER_ADMIN, not moderators", () => {
    for (const action of ["user:edit", "user:reset_password", "user:impersonate", "partnership:create_account"] as const) {
      expect(can("ADMIN", action)).toBe(true);
      expect(can("MODERATOR", action)).toBe(false);
    }
  });
});
