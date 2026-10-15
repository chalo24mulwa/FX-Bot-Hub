import { beforeEach, describe, expect, it, vi } from "vitest";
import type { JWT } from "next-auth/jwt";

const { db, audit } = vi.hoisted(() => ({
  db: {
    impersonationSession: { findUnique: vi.fn(), updateMany: vi.fn() },
    adminRoleGrant: { findMany: vi.fn() },
    user: { findUnique: vi.fn() },
  },
  audit: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ db }));
vi.mock("@/repositories/audit-log-repository", () => ({ recordAuditLog: (...a: unknown[]) => audit(...a) }));

import { beginImpersonationToken, closeImpersonationOnSignOut, endImpersonationToken, impersonationStillValid, loadAdminRoles } from "./impersonation-token";

const NOW = Date.now();
const future = () => new Date(NOW + 30 * 60_000);
const past = () => new Date(NOW - 60_000);

const adminToken = (extra: Partial<JWT> = {}): JWT => ({ id: "admin-1", sub: "admin-1", name: "Ada Admin", email: "ada@x.com", role: "SUPER_ADMIN", adminRoles: [], roleCheckedAt: NOW, ...extra });
const impToken = (extra: Partial<JWT> = {}): JWT => ({
  id: "member-1",
  sub: "member-1",
  name: "Mia Member",
  email: "mia@x.com",
  role: "USER",
  adminRoles: [],
  impSid: "sess-1",
  impAdminId: "admin-1",
  impExp: NOW + 600_000,
  impName: "Mia Member",
  ...extra,
});

function row(over: Record<string, unknown> = {}) {
  return {
    id: "sess-1",
    adminId: "admin-1",
    targetUserId: "member-1",
    endedAt: null,
    expiresAt: future(),
    admin: { id: "admin-1", role: "SUPER_ADMIN", bannedAt: null, mustChangePassword: false },
    target: { id: "member-1", name: "Mia Member", email: "mia@x.com", image: null, role: "USER", bannedAt: null },
    ...over,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  db.adminRoleGrant.findMany.mockResolvedValue([]);
  db.impersonationSession.updateMany.mockResolvedValue({ count: 1 });
  audit.mockResolvedValue(undefined);
});

describe("beginImpersonationToken", () => {
  it("switches the token to the target — id, role, name and email — and keeps only the session id", async () => {
    db.impersonationSession.findUnique.mockResolvedValue(row());
    const t = await beginImpersonationToken(adminToken(), "sess-1");
    expect(t).toMatchObject({ id: "member-1", sub: "member-1", role: "USER", name: "Mia Member", email: "mia@x.com", adminRoles: [], impSid: "sess-1", impAdminId: "admin-1" });
    expect(t.impExp).toBe((row().expiresAt as Date).getTime());
  });

  it("never carries the administrator's role or roles into the member's session", async () => {
    db.impersonationSession.findUnique.mockResolvedValue(row());
    const t = await beginImpersonationToken(adminToken({ adminRoles: ["FINANCE"] }), "sess-1");
    expect(t.role).toBe("USER");
    expect(t.adminRoles).toEqual([]);
  });

  it("ignores a session row that belongs to a different administrator (a forged start payload)", async () => {
    db.impersonationSession.findUnique.mockResolvedValue(row({ adminId: "someone-else" }));
    const original = adminToken();
    expect(await beginImpersonationToken(original, "sess-1")).toBe(original);
  });

  it("ignores unknown, ended and expired sessions", async () => {
    const original = adminToken();
    db.impersonationSession.findUnique.mockResolvedValueOnce(null);
    expect(await beginImpersonationToken(original, "nope")).toBe(original);
    db.impersonationSession.findUnique.mockResolvedValueOnce(row({ endedAt: past() }));
    expect(await beginImpersonationToken(original, "sess-1")).toBe(original);
    db.impersonationSession.findUnique.mockResolvedValueOnce(row({ expiresAt: past() }));
    expect(await beginImpersonationToken(original, "sess-1")).toBe(original);
  });

  it("re-checks eligibility at switch time: staff and suspended targets, and a demoted administrator", async () => {
    const original = adminToken();
    db.impersonationSession.findUnique.mockResolvedValueOnce(row({ target: { id: "member-1", name: "M", email: "m@x.com", image: null, role: "SUPER_ADMIN", bannedAt: null } }));
    expect(await beginImpersonationToken(original, "sess-1")).toBe(original);
    db.impersonationSession.findUnique.mockResolvedValueOnce(row({ target: { id: "member-1", name: "M", email: "m@x.com", image: null, role: "USER", bannedAt: new Date() } }));
    expect(await beginImpersonationToken(original, "sess-1")).toBe(original);
    db.impersonationSession.findUnique.mockResolvedValueOnce(row({ admin: { id: "admin-1", role: "USER", bannedAt: null, mustChangePassword: false } }));
    expect(await beginImpersonationToken(original, "sess-1")).toBe(original);
    db.impersonationSession.findUnique.mockResolvedValueOnce(row({ admin: { id: "admin-1", role: "SUPER_ADMIN", bannedAt: null, mustChangePassword: true } }));
    expect(await beginImpersonationToken(original, "sess-1")).toBe(original);
  });

  it("can't be nested: a token that is already impersonating is returned unchanged", async () => {
    const already = impToken();
    expect(await beginImpersonationToken(already, "sess-2")).toBe(already);
    expect(db.impersonationSession.findUnique).not.toHaveBeenCalled();
  });
});

describe("endImpersonationToken", () => {
  beforeEach(() => {
    db.user.findUnique.mockResolvedValue({ id: "admin-1", name: "Ada Admin", email: "ada@x.com", image: null, role: "SUPER_ADMIN", bannedAt: null });
  });

  it("restores the administrator's own identity and removes every impersonation field", async () => {
    const t = (await endImpersonationToken(impToken(), "exited"))!;
    expect(t).toMatchObject({ id: "admin-1", sub: "admin-1", role: "SUPER_ADMIN", name: "Ada Admin", email: "ada@x.com" });
    for (const key of ["impSid", "impAdminId", "impExp", "impName"]) expect(t).not.toHaveProperty(key);
  });

  it("closes the session row and writes one audit entry linked to the session", async () => {
    await endImpersonationToken(impToken(), "exited");
    expect(db.impersonationSession.updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "sess-1", endedAt: null }, data: expect.objectContaining({ endReason: "exited" }) }));
    expect(audit).toHaveBeenCalledWith(expect.objectContaining({ actorId: "admin-1", action: "impersonation.end", impersonationSessionId: "sess-1", entityId: "member-1" }));
  });

  it("doesn't write a second audit entry when the row was already closed", async () => {
    db.impersonationSession.updateMany.mockResolvedValue({ count: 0 });
    await endImpersonationToken(impToken(), "revoked");
    expect(audit).not.toHaveBeenCalled();
  });

  it("ends the sign-in (null) if the administrator can't be restored", async () => {
    db.user.findUnique.mockResolvedValueOnce({ id: "admin-1", name: "A", email: "a@x.com", image: null, role: "SUPER_ADMIN", bannedAt: new Date() });
    expect(await endImpersonationToken(impToken(), "exited")).toBeNull();
    db.user.findUnique.mockResolvedValueOnce({ id: "admin-1", name: "A", email: "a@x.com", image: null, role: "USER", bannedAt: null });
    expect(await endImpersonationToken(impToken(), "exited")).toBeNull();
    db.user.findUnique.mockResolvedValueOnce(null);
    expect(await endImpersonationToken(impToken(), "exited")).toBeNull();
  });

  it("is a no-op for a token that isn't impersonating", async () => {
    const t = adminToken();
    expect(await endImpersonationToken(t, "exited")).toBe(t);
    expect(db.impersonationSession.updateMany).not.toHaveBeenCalled();
  });
});

describe("impersonationStillValid", () => {
  it("is valid for an open, unexpired session", async () => {
    db.impersonationSession.findUnique.mockResolvedValue({ endedAt: null, expiresAt: future(), endReason: null });
    expect(await impersonationStillValid(impToken())).toEqual({ valid: true });
  });
  it("detects a revoked, vanished or expired session", async () => {
    db.impersonationSession.findUnique.mockResolvedValueOnce({ endedAt: past(), expiresAt: future(), endReason: "revoked" });
    expect(await impersonationStillValid(impToken())).toEqual({ valid: false, reason: "revoked" });
    db.impersonationSession.findUnique.mockResolvedValueOnce(null);
    expect(await impersonationStillValid(impToken())).toEqual({ valid: false, reason: "revoked" });
    db.impersonationSession.findUnique.mockResolvedValueOnce({ endedAt: null, expiresAt: past(), endReason: null });
    expect(await impersonationStillValid(impToken())).toEqual({ valid: false, reason: "expired" });
  });
  it("treats a non-impersonating token as valid", async () => {
    expect(await impersonationStillValid(adminToken())).toEqual({ valid: true });
  });
});

describe("closeImpersonationOnSignOut", () => {
  it("closes the open session and audits it as signed out", async () => {
    await closeImpersonationOnSignOut(impToken());
    expect(db.impersonationSession.updateMany).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ endReason: "signed_out" }) }));
    expect(audit).toHaveBeenCalledWith(expect.objectContaining({ action: "impersonation.end", metadata: { reason: "signed_out" } }));
  });
  it("does nothing for an ordinary token or no token", async () => {
    await closeImpersonationOnSignOut(adminToken());
    await closeImpersonationOnSignOut(null);
    expect(db.impersonationSession.updateMany).not.toHaveBeenCalled();
  });
});

describe("loadAdminRoles", () => {
  it("only looks up grants for moderator-level staff", async () => {
    db.adminRoleGrant.findMany.mockResolvedValue([{ role: "FINANCE" }]);
    expect(await loadAdminRoles("u", "MODERATOR")).toEqual(["FINANCE"]);
    expect(await loadAdminRoles("u", "ADMIN")).toEqual([]);
    expect(await loadAdminRoles("u", "USER")).toEqual([]);
    expect(db.adminRoleGrant.findMany).toHaveBeenCalledTimes(1);
  });
  it("fails closed — an unreadable table means no extra roles, never an error at sign-in", async () => {
    db.adminRoleGrant.findMany.mockRejectedValue(new Error("relation does not exist"));
    expect(await loadAdminRoles("u", "MODERATOR")).toEqual([]);
  });
});
