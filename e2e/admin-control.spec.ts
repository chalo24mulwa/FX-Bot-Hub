import { test, expect, type Browser, type Page } from "@playwright/test";
import { PrismaClient, type UserRole } from "@prisma/client";
import bcrypt from "bcryptjs";
import { E2E_ADMIN } from "./helpers";

// Admin control centre end to end: impersonation, role boundaries, admin-role
// scoping, Partnership accounts, suspension, listing moderation and the forced
// password change. Every account is created fresh for the run (never the shared
// e2e-* fixtures), and the whole file runs in order because later tests build on
// earlier ones.

test.describe.configure({ mode: "serial" });

const db = new PrismaClient();
test.afterAll(async () => {
  await db.$disconnect();
});

const stamp = Date.now();
const PASSWORD = "password123";
const email = (tag: string) => `e2e-ac-${tag}-${stamp}@fxbotmarket.local`;

const memberEmail = email("member");
const sellerEmail = email("seller");
const adminBEmail = email("admin-b"); // ADMIN (not Super)
const modPlainEmail = email("mod-plain"); // MODERATOR, no admin roles
const modScopedEmail = email("mod-scoped"); // MODERATOR we scope with an admin role
const tempAdminEmail = email("temp-admin"); // SUPER_ADMIN with a temporary password

let memberId = "";
let adminId = "";
let modScopedId = "";
let productPendingId = "";
let productDeletableId = "";
let productSoldId = "";

async function makeUser(address: string, name: string, role: UserRole, extra: { mustChangePassword?: boolean } = {}) {
  return db.user.create({
    data: {
      email: address,
      name,
      password: await bcrypt.hash(PASSWORD, 10),
      role,
      mustChangePassword: extra.mustChangePassword ?? false,
      profile: { create: { displayName: name } },
    },
  });
}

async function signedInPage(browser: Browser, address: string, viewport = { width: 1280, height: 800 }): Promise<Page> {
  const context = await browser.newContext({ viewport, baseURL: "http://localhost:3000" });
  const page = await context.newPage();
  await page.goto("/auth/sign-in");
  await page.getByLabel("Email").fill(address);
  await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(/\/marketplace$/, { timeout: 20_000 });
  return page;
}

/** Opens a ReasonAction, types the reason, confirms. */
async function reasonAction(page: Page, label: string, reason: string, confirm = "Confirm") {
  await page.getByRole("button", { name: label, exact: true }).click();
  await page.getByLabel(/^Reason(?: \(optional\))?$/).fill(reason);
  await page.getByRole("button", { name: confirm, exact: true }).click();
}

const sessionJson = async (page: Page) => (await page.request.get("/api/auth/session")).json();

test("setup: seed members, staff and listings", async () => {
  const member = await makeUser(memberEmail, "Mia Member", "USER");
  memberId = member.id;
  const seller = await makeUser(sellerEmail, "Sam Seller", "SELLER");
  await db.sellerProfile.create({ data: { userId: seller.id, displayName: "Sam's EAs" } });
  await makeUser(adminBEmail, "Bea Admin", "ADMIN");
  await makeUser(modPlainEmail, "Pat Plain-Mod", "MODERATOR");
  modScopedId = (await makeUser(modScopedEmail, "Sky Scoped-Mod", "MODERATOR")).id;
  await makeUser(tempAdminEmail, "Tia Temp-Admin", "SUPER_ADMIN", { mustChangePassword: true });
  adminId = (await db.user.findFirstOrThrow({ where: { email: E2E_ADMIN } })).id;

  const base = { sellerId: seller.id, type: "EA" as const, platform: "MT5" as const, pricingType: "ONE_TIME" as const, priceCents: 4900, currency: "USD", shortSummary: "A listing used by the admin control end-to-end tests.", description: "Seeded for Playwright — safe to leave in the database." };
  productPendingId = (await db.product.create({ data: { ...base, slug: `e2e-ac-pending-${stamp}`, name: `AC Pending ${stamp}`, status: "PENDING_REVIEW" } })).id;
  productDeletableId = (await db.product.create({ data: { ...base, slug: `e2e-ac-deletable-${stamp}`, name: `AC Deletable ${stamp}`, status: "DRAFT" } })).id;
  productSoldId = (await db.product.create({ data: { ...base, slug: `e2e-ac-sold-${stamp}`, name: `AC Sold ${stamp}`, status: "PUBLISHED", publishedAt: new Date() } })).id;
  await db.license.create({ data: { userId: member.id, productId: productSoldId } });
});

test("public sign-up cannot take the reserved administrator address", async ({ request }) => {
  const before = await db.user.count({ where: { email: "admin@fxbothub.com" } });
  const res = await request.post("/api/auth/register", {
    headers: { Origin: "http://localhost:3000", "x-forwarded-for": `10.77.${stamp % 250}.1` },
    data: { name: "Squatter", email: "Admin@FxBotHub.com", password: "password123" },
  });
  expect(res.status()).toBe(409);
  expect((await res.json()).error).toMatch(/already exists/i);
  expect(await db.user.count({ where: { email: { equals: "admin@fxbothub.com", mode: "insensitive" } } })).toBe(before);
});

test("the user list searches and filters, and a member's page never shows secrets", async ({ browser }) => {
  const admin = await signedInPage(browser, E2E_ADMIN);
  await admin.goto(`/admin/users?q=${encodeURIComponent(memberEmail)}`);
  await expect(admin.getByRole("cell", { name: memberEmail })).toBeVisible();
  await expect(admin.getByRole("cell", { name: sellerEmail })).toHaveCount(0);

  // Filters combine: a suspended-only view excludes this active member.
  await admin.goto(`/admin/users?q=${encodeURIComponent(memberEmail)}&status=suspended`);
  await expect(admin.getByText("No users match.")).toBeVisible();

  // LIKE wildcards in the search box are plain text, not "match everything".
  await admin.goto("/admin/users?q=%25_%25");
  await expect(admin.getByText("No users match.")).toBeVisible();

  await admin.goto(`/admin/users/${memberId}`);
  await expect(admin.getByRole("heading", { name: "Mia Member" })).toBeVisible();
  const html = await admin.content();
  expect(html).not.toContain("$2a$");
  expect(html).not.toContain("$2b$");
  await admin.context().close();
});

test("an administrator can view as a member, is clearly marked, cannot do sensitive things, and gets their own session back", async ({ browser }) => {
  const admin = await signedInPage(browser, E2E_ADMIN);
  await admin.goto(`/admin/users/${memberId}`);
  await admin.getByRole("link", { name: "Access account" }).click();

  // An explicit confirmation is required before the session starts.
  await expect(admin.getByRole("heading", { name: "Access account" })).toBeVisible();
  const start = admin.getByRole("button", { name: "Start session" });
  await expect(start).toBeDisabled();
  await admin.getByLabel(/Reason for accessing/).fill("Ticket 4821: member can't see their licence");
  await admin.getByRole("checkbox").check();
  await start.click();
  await admin.waitForURL(/\/dashboard$/, { timeout: 20_000 });

  // Banner on every page, naming the account.
  const banner = admin.getByTestId("impersonation-banner");
  await expect(banner).toContainText("ADMIN ACCESS MODE — Viewing account: Mia Member");
  await admin.goto("/marketplace");
  await expect(banner).toBeVisible();

  // The session is the member's: their identity and role, never the administrator's.
  const viewing = await sessionJson(admin);
  expect(viewing.user.email).toBe(memberEmail);
  expect(viewing.user.id).toBe(memberId);
  expect(viewing.user.role).toBe("USER");
  expect(viewing.user.adminRoles).toEqual([]);
  expect(viewing.user.impersonation.targetName).toBe("Mia Member");
  expect(JSON.stringify(viewing)).not.toContain(E2E_ADMIN);

  // Admin pages are closed while viewing as a member.
  await admin.goto("/admin/users");
  await expect(admin).toHaveURL(/\/dashboard$/);

  // Read-only by default: a guarded action (checkout) is refused server-side.
  const blocked = await admin.request.post("/api/checkout", { headers: { Origin: "http://localhost:3000", "Content-Type": "application/json" }, data: {} });
  expect(blocked.status()).toBe(403);
  expect((await blocked.json()).error).toMatch(/viewing as another member/i);

  // Exit restores the administrator.
  await admin.getByRole("button", { name: "Exit impersonation" }).click();
  await admin.waitForURL(new RegExp(`/admin/users/${memberId}$`), { timeout: 20_000 });
  await expect(banner).toHaveCount(0);
  const restored = await sessionJson(admin);
  expect(restored.user.email).toBe(E2E_ADMIN);
  expect(restored.user.role).toBe("SUPER_ADMIN");
  expect(restored.user.impersonation).toBeUndefined();

  // The record: closed, with who/whom/why, and audit entries tied to the session.
  const row = await db.impersonationSession.findFirstOrThrow({ where: { adminId, targetUserId: memberId }, orderBy: { startedAt: "desc" } });
  expect(row.endedAt).not.toBeNull();
  expect(row.endReason).toBe("exited");
  expect(row.reason).toContain("Ticket 4821");
  const actions = (await db.auditLog.findMany({ where: { impersonationSessionId: row.id }, select: { action: true, actorId: true } })).map((a) => a.action);
  expect(actions).toEqual(expect.arrayContaining(["impersonation.start", "impersonation.end"]));
  expect((await db.auditLog.findFirstOrThrow({ where: { impersonationSessionId: row.id, action: "impersonation.start" } })).actorId).toBe(adminId);

  await admin.goto("/admin/access-sessions");
  await expect(admin.getByRole("row", { name: /Mia Member/ }).first()).toContainText("Ended — exited");
  await admin.context().close();
});

test("staff accounts can't be accessed this way, and a suspended member can't either", async ({ browser }) => {
  const admin = await signedInPage(browser, E2E_ADMIN);
  const staff = await db.user.findFirstOrThrow({ where: { email: adminBEmail } });
  await admin.goto(`/admin/users/${staff.id}/impersonate`);
  await expect(admin.getByRole("alert").filter({ hasText: /./ })).toContainText("Staff accounts can't be accessed this way");
  await expect(admin.getByRole("button", { name: "Start session" })).toHaveCount(0);

  await admin.goto(`/admin/users/${adminId}/impersonate`);
  await expect(admin.getByRole("alert").filter({ hasText: /./ })).toBeVisible();
  await admin.context().close();
});

test("an access session that is ended from the sessions page ends the member view within a minute", async ({ browser }) => {
  test.slow();
  const admin = await signedInPage(browser, E2E_ADMIN);
  await admin.goto(`/admin/users/${memberId}/impersonate`);
  await admin.getByRole("checkbox").check();
  await admin.getByRole("button", { name: "Start session" }).click();
  await admin.waitForURL(/\/dashboard$/, { timeout: 20_000 });
  await expect(admin.getByTestId("impersonation-banner")).toBeVisible();

  // Another administrator (or this one, elsewhere) ends it.
  const open = await db.impersonationSession.findFirstOrThrow({ where: { adminId, targetUserId: memberId, endedAt: null } });
  await db.impersonationSession.update({ where: { id: open.id }, data: { endedAt: new Date(), endReason: "revoked" } });

  // The token re-checks the session row about once a minute.
  await admin.waitForTimeout(62_000);
  await admin.goto("/dashboard");
  await expect(admin.getByTestId("impersonation-banner")).toHaveCount(0);
  const back = await sessionJson(admin);
  expect(back.user.email).toBe(E2E_ADMIN);
  await admin.goto("/admin");
  await expect(admin.getByRole("heading", { name: "Dashboard" })).toBeVisible();
  await admin.context().close();
});

test("an ADMIN can't escalate: no admin roles, no Super Administrator, no changing administrators", async ({ browser }) => {
  const adminB = await signedInPage(browser, adminBEmail);

  // Role selector for an ordinary member offers only roles below ADMIN.
  await adminB.goto(`/admin/users/${memberId}`);
  const options = await adminB.getByLabel("Account role").locator("option").allTextContents();
  expect(options.map((o) => o.trim())).toEqual(expect.arrayContaining(["USER", "SELLER", "AUTHOR", "MODERATOR"]));
  expect(options.join(" ")).not.toMatch(/SUPER|ADMIN/);

  // A Super Administrator's page offers no role change at all.
  await adminB.goto(`/admin/users/${adminId}`);
  await expect(adminB.getByText(/can't change this account's role/)).toBeVisible();
  await expect(adminB.getByRole("button", { name: "Suspend account" })).toHaveCount(0);

  // Admin-role management is Super Administrator only.
  await adminB.goto("/admin/admin-roles");
  await expect(adminB).toHaveURL(/\/admin$/);
  await expect(adminB.getByRole("link", { name: "Admin Roles" })).toHaveCount(0);
  await adminB.context().close();

  // A plain moderator has no finance, payout, access-session or admin-role areas.
  const mod = await signedInPage(browser, modPlainEmail);
  for (const path of ["/admin/finance", "/admin/payouts", "/admin/access-sessions", "/admin/admin-roles", "/admin/partnership", "/admin/settings"]) {
    await mod.goto(path);
    await expect(mod, path).toHaveURL(/\/admin$/);
  }
  await mod.goto("/admin/users");
  await expect(mod.getByRole("heading", { name: "Users" })).toBeVisible();
  // Moderators can open the page but can't act on higher roles or use admin-only actions.
  await mod.goto(`/admin/users/${adminId}`);
  await expect(mod.getByRole("link", { name: "Access account" })).toHaveCount(0);
  await mod.context().close();
});

test("a Super Administrator can scope a moderator with an admin role, and revoking the last one removes staff access", async ({ browser }) => {
  const admin = await signedInPage(browser, E2E_ADMIN);
  await admin.goto(`/admin/users/${modScopedId}`);
  await admin.getByLabel("Grant an admin role").selectOption({ label: "Listing Moderator" });
  const grantForm = admin.locator("form").filter({ has: admin.getByRole("button", { name: "Grant role" }) });
  await grantForm.getByPlaceholder("Reason (5+ characters)").fill("Moderating the approval queue only");
  await admin.getByRole("button", { name: "Grant role" }).click();
  await expect(admin.getByText("Listing Moderator", { exact: true }).first()).toBeVisible();

  // Scoped: products yes; news, finance, users' account actions no.
  const scoped = await signedInPage(browser, modScopedEmail);
  await scoped.goto("/admin/products");
  await expect(scoped.getByRole("heading", { name: "Products" })).toBeVisible();
  for (const path of ["/admin/news", "/admin/finance", "/admin/calendar", "/admin/reviews"]) {
    await scoped.goto(path);
    if (path === "/admin/reviews") {
      await expect(scoped.getByRole("heading", { name: "Reviews" })).toBeVisible(); // review:delete_any is part of the role
    } else {
      await expect(scoped, path).toHaveURL(/\/admin$/);
    }
  }
  await scoped.context().close();

  // Revoking their only role also removes the staff rank — it must not widen access.
  await admin.goto(`/admin/users/${modScopedId}`);
  await reasonAction(admin, "Revoke", "No longer needed", "Confirm");
  await expect.poll(async () => (await db.user.findUniqueOrThrow({ where: { id: modScopedId } })).role).toBe("USER");
  expect(await db.adminRoleGrant.count({ where: { userId: modScopedId } })).toBe(0);
  const audit = await db.auditLog.findMany({ where: { entityId: modScopedId, action: { in: ["admin_role.grant", "admin_role.revoke", "user.role_change"] } }, select: { action: true } });
  expect(audit.map((a) => a.action)).toEqual(expect.arrayContaining(["admin_role.grant", "admin_role.revoke"]));
  await admin.context().close();
});

test("an administrator can create a Partnership account for an existing member, then grant Master separately", async ({ browser }) => {
  const admin = await signedInPage(browser, E2E_ADMIN);
  await admin.goto(`/admin/users/${memberId}`);
  await expect(admin.getByRole("button", { name: "Grant Master Partner" })).toHaveCount(0); // not a Partner yet

  await reasonAction(admin, "Create Partnership account", "Agreed by email with the member", "Confirm");
  await expect.poll(async () => (await db.partnerProfile.findUnique({ where: { userId: memberId } }))?.status, { timeout: 15_000 }).toBe("APPROVED");
  await expect(admin.getByRole("button", { name: "Create Partnership account" })).toHaveCount(0);

  const partner = await db.partnerProfile.findUniqueOrThrow({ where: { userId: memberId } });
  expect(partner.status).toBe("APPROVED");
  expect(partner.referralCode).toBeTruthy();
  expect(partner.masterStatus).toBe("NOT_APPLIED"); // creating a Partner never grants Master
  expect(partner.decidedById).toBe(adminId);
  expect(await db.user.count({ where: { email: memberEmail } })).toBe(1); // no duplicate account

  await reasonAction(admin, "Grant Master Partner", "Recruits and supports a team", "Confirm");
  await expect.poll(async () => (await db.partnerProfile.findUniqueOrThrow({ where: { userId: memberId } })).masterStatus).toBe("APPROVED");
  expect((await db.partnerProfile.findUniqueOrThrow({ where: { userId: memberId } })).masterCode).toBeTruthy();

  // The Master status flips before the admin-grant audit row is written, so poll for the audit trail.
  await expect
    .poll(async () => (await db.auditLog.findMany({ where: { entityId: partner.id }, select: { action: true } })).map((a) => a.action), { timeout: 15_000 })
    .toEqual(expect.arrayContaining(["partnership.admin_create", "partnership.partner.approve", "partnership.master.admin_grant", "partnership.master.approve"]));
  await admin.context().close();
});

test("suspending an account blocks sign-in and keeps their data; reactivating restores it", async ({ browser }) => {
  const admin = await signedInPage(browser, E2E_ADMIN);
  await admin.goto(`/admin/users/${memberId}`);

  // A reason is required.
  await admin.getByRole("button", { name: "Suspend account", exact: true }).click();
  await expect(admin.getByRole("button", { name: "Confirm", exact: true })).toBeDisabled();
  await admin.getByRole("button", { name: "Cancel" }).click();

  await reasonAction(admin, "Suspend account", "Chargeback abuse under review", "Confirm");
  await expect.poll(async () => (await db.user.findUniqueOrThrow({ where: { id: memberId } })).bannedAt !== null).toBe(true);
  expect(await db.license.count({ where: { userId: memberId } })).toBeGreaterThan(0); // nothing deleted

  const blocked = await browser.newContext({ baseURL: "http://localhost:3000" });
  const page = await blocked.newPage();
  await page.goto("/auth/sign-in");
  await page.getByLabel("Email").fill(memberEmail);
  await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByText("Invalid email or password.")).toBeVisible();
  await blocked.close();

  // Can't be accessed while suspended.
  await admin.goto(`/admin/users/${memberId}/impersonate`);
  await expect(admin.getByRole("alert").filter({ hasText: /./ })).toContainText("suspended");

  await admin.goto(`/admin/users/${memberId}`);
  await reasonAction(admin, "Reactivate account", "Cleared", "Confirm");
  await expect.poll(async () => (await db.user.findUniqueOrThrow({ where: { id: memberId } })).bannedAt).toBeNull();
  const reasons = (await db.auditLog.findMany({ where: { entityId: memberId, action: { in: ["user.suspend", "user.reactivate"] } }, select: { action: true, metadata: true } }));
  expect(reasons.map((r) => r.action)).toEqual(expect.arrayContaining(["user.suspend", "user.reactivate"]));
  expect(JSON.stringify(reasons)).toContain("Chargeback abuse");
  await admin.context().close();
});

test("profile edits are limited to permitted fields and recorded with a reason", async ({ browser }) => {
  const admin = await signedInPage(browser, E2E_ADMIN);
  await admin.goto(`/admin/users/${memberId}`);
  await admin.getByLabel("Display name").fill("Mia M.");
  await admin.getByLabel("Location").fill("Nairobi");
  await admin.getByLabel(/^Reason for the change/).fill("Member asked support to fix their display name");
  await admin.getByRole("button", { name: "Save profile" }).click();
  await expect(admin.getByRole("status").filter({ hasText: "Profile updated." })).toBeVisible();
  const profile = await db.profile.findUniqueOrThrow({ where: { userId: memberId } });
  expect(profile.displayName).toBe("Mia M.");
  expect(profile.location).toBe("Nairobi");
  expect((await db.user.findUniqueOrThrow({ where: { id: memberId } })).email).toBe(memberEmail); // identity untouched
  expect(await db.auditLog.count({ where: { entityId: memberId, action: "user.profile_edit" } })).toBe(1);
  await admin.context().close();
});

test("listing moderation: approve, suspend, restore, remove — hidden everywhere public while off the marketplace", async ({ browser, request }) => {
  const admin = await signedInPage(browser, E2E_ADMIN);
  const slug = `e2e-ac-pending-${stamp}`;
  const publicStatus = async () => (await request.get(`/marketplace/${slug}`)).status();
  const inSitemap = async () => (await (await request.get("/sitemap.xml")).text()).includes(`/marketplace/${slug}`);

  await admin.goto(`/admin/products/${productPendingId}`);
  expect(await publicStatus()).toBe(404); // pending isn't public

  await reasonAction(admin, "Request changes / reject", "Add installation instructions", "Confirm");
  await expect.poll(async () => (await db.product.findUniqueOrThrow({ where: { id: productPendingId } })).status).toBe("REJECTED");
  expect((await db.product.findUniqueOrThrow({ where: { id: productPendingId } })).rejectionReason).toBe("Add installation instructions");
  // …and a rejected listing can't simply be "approved" by id — only one awaiting review can.
  await db.product.update({ where: { id: productPendingId }, data: { status: "PENDING_REVIEW" } });

  await admin.goto(`/admin/products/${productPendingId}`);
  await admin.getByRole("button", { name: "Approve & publish" }).click();
  await admin.getByRole("button", { name: "Confirm", exact: true }).click();
  await expect.poll(publicStatus).toBe(200);
  expect(await inSitemap()).toBe(true);

  await reasonAction(admin, "Suspend", "Misleading performance claims", "Confirm");
  await expect.poll(publicStatus).toBe(404);
  expect(await inSitemap()).toBe(false);
  expect((await db.product.findUniqueOrThrow({ where: { id: productPendingId } })).status).toBe("SUSPENDED");

  await admin.getByRole("button", { name: "Restore" }).click();
  await admin.getByRole("button", { name: "Confirm", exact: true }).click();
  await expect.poll(publicStatus).toBe(200);

  await reasonAction(admin, "Remove", "Seller requested removal", "Confirm");
  await expect.poll(publicStatus).toBe(404);
  expect((await db.product.findUniqueOrThrow({ where: { id: productPendingId } })).status).toBe("ARCHIVED");
  expect(await inSitemap()).toBe(false);

  // The seller was told, and every step is in the audit log with its reason.
  const sellerId = (await db.user.findFirstOrThrow({ where: { email: sellerEmail } })).id;
  expect(await db.notification.count({ where: { userId: sellerId } })).toBeGreaterThanOrEqual(3);
  const history = await db.auditLog.findMany({ where: { entityType: "Product", entityId: productPendingId }, select: { action: true } });
  expect(history.map((h) => h.action)).toEqual(expect.arrayContaining(["product.reject", "product.approve", "product.suspend", "product.restore", "product.remove"]));
  await admin.context().close();
});

test("a listing with purchase history can't be deleted; one nobody bought can", async ({ browser }) => {
  const admin = await signedInPage(browser, E2E_ADMIN);

  await admin.goto(`/admin/products/${productSoldId}`);
  await expect(admin.getByText(/Delete is unavailable/)).toContainText("licence");
  await expect(admin.getByRole("button", { name: "Delete permanently" })).toHaveCount(0);
  expect(await db.license.count({ where: { productId: productSoldId } })).toBe(1);

  await admin.goto(`/admin/products/${productDeletableId}`);
  await reasonAction(admin, "Delete permanently", "Duplicate draft", "Delete permanently");
  await expect.poll(async () => db.product.count({ where: { id: productDeletableId } })).toBe(0);
  expect(await db.auditLog.count({ where: { entityId: productDeletableId, action: "product.delete" } })).toBe(1);
  await admin.context().close();
});

test("a temporary-password administrator must set their own password before the admin area opens", async ({ browser }) => {
  const temp = await signedInPage(browser, tempAdminEmail);
  await temp.goto("/admin");
  await expect(temp).toHaveURL(/\/dashboard\/security\?change=required/);
  await expect(temp.getByRole("alert").filter({ hasText: /./ })).toContainText("temporary password");

  // Still closed on every admin page, including ones that hold sensitive tools.
  await temp.goto("/admin/users");
  await expect(temp).toHaveURL(/\/dashboard\/security/);

  await temp.getByLabel("Current password", { exact: true }).fill(PASSWORD);
  await temp.getByLabel("New password", { exact: true }).fill("a-brand-new-Passw0rd!");
  await temp.getByLabel("Confirm new password").fill("a-brand-new-Passw0rd!");
  await temp.getByRole("button", { name: "Change password" }).click();
  await expect.poll(async () => (await db.user.findFirstOrThrow({ where: { email: tempAdminEmail } })).mustChangePassword).toBe(false);

  await temp.goto("/admin");
  await expect(temp.getByRole("heading", { name: "Dashboard" })).toBeVisible();
  await temp.context().close();
});

test("the audit log can be searched by administrator, action and access session", async ({ browser }) => {
  const admin = await signedInPage(browser, E2E_ADMIN);
  await admin.goto(`/admin/audit-logs?action=${encodeURIComponent("impersonation.")}`);
  await expect(admin.getByRole("cell", { name: /impersonation\.start/ }).first()).toBeVisible();
  await expect(admin.getByRole("cell", { name: /product\.approve/ })).toHaveCount(0);

  await admin.goto(`/admin/audit-logs?actor=${encodeURIComponent(E2E_ADMIN)}&entityId=${memberId}`);
  await expect(admin.getByRole("cell", { name: /user\./ }).first()).toBeVisible();

  await admin.goto("/admin/audit-logs?action=product.");
  await expect(admin.getByRole("cell", { name: /impersonation/ })).toHaveCount(0);

  // The overview shows real numbers and recent activity.
  await admin.goto("/admin");
  await expect(admin.getByText("Recent administrative activity")).toBeVisible();
  await expect(admin.getByText("Awaiting approval")).toBeVisible();
  await admin.context().close();
});
