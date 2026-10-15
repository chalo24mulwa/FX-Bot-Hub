import { beforeEach, describe, expect, it, vi } from "vitest";

const { auth, audit, headersFn } = vi.hoisted(() => ({ auth: vi.fn(), audit: vi.fn(), headersFn: vi.fn() }));

vi.mock("@/lib/auth", () => ({ auth: (...a: unknown[]) => auth(...a) }));
vi.mock("next/headers", () => ({ headers: (...a: unknown[]) => headersFn(...a) }));
vi.mock("@/repositories/audit-log-repository", () => ({ recordAuditLog: (...a: unknown[]) => audit(...a) }));
vi.mock("@/lib/security/csrf", () => ({ CsrfError: class extends Error {} }));
vi.mock("@/lib/security/rate-limit", () => ({ RateLimitError: class extends Error {} }));

import { AuthorizationError, requirePermission, requireSession } from "./guard";

const member = { id: "member-1", role: "SELLER" as const, adminRoles: [] };
const impersonated = { ...member, impersonation: { sessionId: "sess-1", adminId: "admin-1", targetName: "Mia", expiresAt: Date.now() + 60_000 } };

beforeEach(() => {
  vi.clearAllMocks();
  audit.mockResolvedValue(undefined);
  headersFn.mockResolvedValue(new Headers({ referer: "https://fxbothub.com/seller/products/abc?token=secret#x" }));
});

describe("requireSession", () => {
  it("rejects when nobody is signed in", async () => {
    auth.mockResolvedValue(null);
    await expect(requireSession()).rejects.toMatchObject({ status: 401 });
  });

  it("lets an ordinary session through without writing any audit entry", async () => {
    auth.mockResolvedValue({ user: member });
    await expect(requireSession()).resolves.toBeTruthy();
    expect(audit).not.toHaveBeenCalled();
  });

  it("refuses every guarded action while viewing as another member (read-only by default)", async () => {
    auth.mockResolvedValue({ user: impersonated });
    await expect(requireSession()).rejects.toBeInstanceOf(AuthorizationError);
    await expect(requireSession()).rejects.toMatchObject({ status: 403 });
    expect(audit).not.toHaveBeenCalled();
  });

  it("allows an opted-in action during impersonation and records it against the session — path only, no query string", async () => {
    auth.mockResolvedValue({ user: impersonated });
    await expect(requireSession({ allowImpersonation: true })).resolves.toBeTruthy();
    expect(audit).toHaveBeenCalledWith(
      expect.objectContaining({ actorId: "admin-1", action: "impersonation.action", entityId: "member-1", impersonationSessionId: "sess-1", metadata: { path: "/seller/products/abc" } }),
    );
    expect(JSON.stringify(audit.mock.calls)).not.toContain("secret");
  });

  it("fails closed: if the audit entry can't be written, the opted-in action doesn't proceed", async () => {
    auth.mockResolvedValue({ user: impersonated });
    audit.mockRejectedValue(new Error("db down"));
    await expect(requireSession({ allowImpersonation: true })).rejects.toThrow("db down");
  });
});

describe("requirePermission", () => {
  it("checks the capability against the whole session user, so admin roles count", async () => {
    auth.mockResolvedValue({ user: { id: "m", role: "MODERATOR", adminRoles: ["FINANCE"] } });
    await expect(requirePermission("payout:manage")).resolves.toBeTruthy();
    await expect(requirePermission("product:moderate")).rejects.toMatchObject({ status: 403 });
  });

  it("still enforces the permission for an opted-in action during impersonation", async () => {
    auth.mockResolvedValue({ user: { ...impersonated, role: "USER" } });
    await expect(requirePermission("product:create", { allowImpersonation: true })).rejects.toMatchObject({ status: 403 });
  });

  it("lets a member's own selling permission through when the action opts in", async () => {
    auth.mockResolvedValue({ user: impersonated });
    await expect(requirePermission("product:create", { allowImpersonation: true })).resolves.toBeTruthy();
  });
});
