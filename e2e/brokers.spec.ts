import { test, expect, type Browser, type Page } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

// Best Brokers end to end, driven through the real admin UI: add a broker with a logo, publish it, see it on
// the public page with the right links, rank/filter/edit/unpublish/archive/restore/delete, reject unsafe
// links, keep unauthorised users out, and check the mobile layout and SEO. Brokers are created fresh for the
// run and all removed again at the end. Serial, because later steps build on earlier ones.

test.describe.configure({ mode: "serial" });

const db = new PrismaClient();
const stamp = Date.now();
const PASSWORD = "password123";
const A_NAME = `E2E Alpha Broker ${stamp}`;
const B_NAME = `E2E Beta Broker ${stamp}`;
const A_SLUG = `e2e-alpha-broker-${stamp}`;
const B_SLUG = `e2e-beta-broker-${stamp}`;
const AFFILIATE = "https://go.alpha-example.com/ref/fxbothub?campaign=e2e";
const OFFICIAL = "https://www.alpha-example.com";
const modEmail = `e2e-broker-mod-${stamp}@fxbotmarket.local`;
const adminEmail = "e2e-admin@fxbotmarket.local";
// A real 1x1 PNG.
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");

let adminPage: Page;
let aId = "";
let bId = "";

async function signedIn(browser: Browser, address: string, viewport = { width: 1280, height: 900 }): Promise<Page> {
  const context = await browser.newContext({ viewport, baseURL: "http://localhost:3000" });
  const page = await context.newPage();
  await page.goto("/auth/sign-in");
  await page.getByLabel("Email").fill(address);
  await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(/\/marketplace$/, { timeout: 20_000 });
  return page;
}

/** Public order of this run's brokers (other brokers in the database are ignored). */
async function publicOrder(page: Page, filter = ""): Promise<string[]> {
  await page.goto(`/best-brokers${filter}`);
  const names = await page.locator("article[aria-label]").evaluateAll((els) => els.map((el) => el.getAttribute("aria-label") ?? ""));
  return names.filter((n) => n.includes(String(stamp)));
}

test.beforeAll(async ({ browser }) => {
  await db.user.create({
    data: { email: modEmail, name: "Broker Mod", password: await bcrypt.hash(PASSWORD, 10), role: "MODERATOR", profile: { create: { displayName: "Broker Mod" } } },
  });
  adminPage = await signedIn(browser, adminEmail);
});

test.afterAll(async () => {
  await db.broker.deleteMany({ where: { OR: [{ slug: { in: [A_SLUG, B_SLUG] } }, { name: `E2E Unsafe ${stamp}` }] } });
  await db.user.deleteMany({ where: { email: modEmail } });
  await db.$disconnect();
});

test("an administrator adds a broker with a logo; it stays a draft and private until published", async ({ browser }) => {
  await adminPage.goto("/admin/brokers/new");
  await adminPage.getByLabel("Broker name").fill(A_NAME);
  await adminPage.getByLabel("Tagline").fill("Tight pricing on majors");
  await adminPage.getByLabel("Official website").fill(OFFICIAL);
  await adminPage.getByLabel("Affiliate / referral link").fill(AFFILIATE);
  await adminPage.locator("#logo").setInputFiles({ name: "logo.png", mimeType: "image/png", buffer: PNG });
  await adminPage.getByLabel("Key features and advantages").fill("Fast execution\nNo requotes\nMobile app");
  await adminPage.getByLabel("Why we selected this broker").fill("Clear pricing and a wide choice of platforms for new traders.");
  await adminPage.getByRole("checkbox", { name: "Beginners", exact: true }).check();
  await adminPage.getByRole("checkbox", { name: "MT4", exact: true }).check();
  await adminPage.getByLabel("Minimum deposit").fill("$100");
  await adminPage.getByLabel("Regulation and licensing").fill("Authorised and regulated by an example regulator, licence EX-123");
  await adminPage.getByLabel("Information verified on").fill("2026-01-15");
  await adminPage.getByLabel("Rating (0").fill("4.5");
  await adminPage.getByRole("button", { name: "Create broker" }).click();

  await adminPage.waitForURL(/\/admin\/brokers\/[a-z0-9]+\?created=1$/, { timeout: 20_000 });
  aId = new URL(adminPage.url()).pathname.split("/").pop() ?? "";
  await expect(adminPage.getByRole("heading", { name: A_NAME, level: 1 })).toBeVisible();
  // The preview shows the saved listing, flagged as a preview.
  const preview = adminPage.locator(`article[aria-label="${A_NAME}"]`);
  await expect(preview).toBeVisible();
  await expect(preview.getByText("Preview", { exact: true })).toBeVisible();
  await expect(preview.getByText("Fast execution")).toBeVisible();

  // Private while a draft: not listed, no profile page, no logo for the public.
  const visitor = await browser.newContext({ baseURL: "http://localhost:3000" });
  const anon = await visitor.newPage();
  expect(await publicOrder(anon)).toEqual([]);
  expect((await anon.request.get(`/best-brokers/${A_SLUG}`)).status()).toBe(404);
  expect((await anon.request.get(`/api/brokers/${aId}/logo`)).status()).toBe(404);
  expect((await anon.request.get("/sitemap.xml").then((r) => r.text()))).not.toContain(A_SLUG);
  // …but the administrator can see the draft's logo while previewing.
  expect((await adminPage.request.get(`/api/brokers/${aId}/logo`)).status()).toBe(200);
  await visitor.close();
});

test("publishing puts it on the public page with its ranking, logo, features and links", async ({ browser }) => {
  await adminPage.goto(`/admin/brokers/${aId}`);
  await adminPage.getByRole("button", { name: "Publish", exact: true }).click();
  await expect(adminPage.getByRole("button", { name: "Unpublish" })).toBeVisible({ timeout: 15_000 });

  const visitor = await browser.newContext({ baseURL: "http://localhost:3000" });
  const page = await visitor.newPage();
  expect(await publicOrder(page)).toEqual([A_NAME]);

  const card = page.locator(`article[aria-label="${A_NAME}"]`);
  await expect(card.getByText("Tight pricing on majors")).toBeVisible();
  await expect(card.getByText("No requotes")).toBeVisible();
  await expect(card.getByText("Clear pricing and a wide choice of platforms")).toBeVisible();
  await expect(card.getByText("MT4", { exact: true })).toBeVisible();
  await expect(card.getByText("$100")).toBeVisible();
  await expect(card.getByText("EX-123", { exact: false })).toBeVisible();
  await expect(card.getByText("Information checked 15 Jan 2026")).toBeVisible();
  await expect(card.getByText("4.5")).toBeVisible();
  await expect(card.getByText("Not provided").first()).toBeVisible(); // instruments, spreads, accounts weren't entered

  // Logo: served as a real PNG, never sniffed.
  const logo = card.getByRole("img", { name: `${A_NAME} logo` });
  await expect(logo).toBeVisible();
  const logoRes = await page.request.get(`/api/brokers/${aId}/logo`);
  expect(logoRes.status()).toBe(200);
  expect(logoRes.headers()["content-type"]).toBe("image/png");
  expect(logoRes.headers()["x-content-type-options"]).toBe("nosniff");

  // Affiliate link is the main button, labelled and marked sponsored; the official site stays reachable.
  const join = card.getByRole("link", { name: /^Join Broker/ });
  await expect(join).toHaveAttribute("href", AFFILIATE);
  await expect(join).toHaveAttribute("target", "_blank");
  const rel = (await join.getAttribute("rel")) ?? "";
  for (const token of ["sponsored", "nofollow", "noopener", "noreferrer"]) expect(rel.split(" ")).toContain(token);
  await expect(card.getByText("Affiliate link", { exact: true })).toBeVisible();
  const official = card.getByRole("link", { name: "alpha-example.com", exact: true });
  await expect(official).toHaveAttribute("href", `${OFFICIAL}/`);
  expect(((await official.getAttribute("rel")) ?? "").split(" ")).not.toContain("sponsored");

  // Disclosure sits with the rankings; comparison table lists it too.
  await expect(page.getByLabel("Advertising disclosure")).toContainText("affiliate or referral links");
  await expect(page.getByRole("region", { name: /Broker comparison table/ }).getByRole("link", { name: A_NAME, exact: true })).toBeVisible();

  // "View Details" opens the profile.
  await card.getByRole("link", { name: /^View Details/ }).click();
  await expect(page).toHaveURL(new RegExp(`/best-brokers/${A_SLUG}$`));
  await expect(page.getByRole("heading", { name: A_NAME, level: 1 })).toBeVisible();
  await expect(page.getByLabel("Advertising disclosure")).toBeVisible();
  await visitor.close();
});

test("the public page has the right SEO: title, description, canonical, social tags, H1, sitemap, structured data", async ({ browser }) => {
  const context = await browser.newContext({ baseURL: "http://localhost:3000" });
  const page = await context.newPage();
  await page.goto("/best-brokers");
  await expect(page).toHaveTitle("Best Forex Brokers 2026 | Compare Trading Platforms | FXBotHub");
  const meta = (selector: string) => page.locator(selector).first().getAttribute("content");
  expect(await meta('meta[name="description"]')).toMatch(/^Compare forex brokers on FXBotHub\./);
  expect(await meta('meta[property="og:title"]')).toContain("Best Forex Brokers 2026");
  expect(await meta('meta[property="og:description"]')).toContain("Compare forex brokers");
  expect(await page.locator('link[rel="canonical"]').getAttribute("href")).toMatch(/\/best-brokers$/);
  const robots = await page.locator('meta[name="robots"]').evaluateAll((els) => els.map((el) => el.getAttribute("content") ?? ""));
  expect(robots.join(",")).not.toMatch(/noindex/); // indexable
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Find the Right Forex Broker for Your Trading Journey");
  for (const h of ["Top-ranked brokers", "Compare side by side", "How to choose a forex broker", "Frequently asked questions"]) {
    await expect(page.getByRole("heading", { name: h, level: 2 })).toBeVisible();
  }
  // FAQ answers and disclosure are in the server-rendered HTML (not behind client JS).
  const html = await (await page.request.get("/best-brokers")).text();
  expect(html).toContain("Does FXBotHub receive commissions from broker links?");
  expect(html).toContain(A_NAME);

  const ld = await page.locator('script[type="application/ld+json"]').allTextContents();
  const types = ld.map((t) => JSON.parse(t)["@type"]);
  expect(types).toEqual(expect.arrayContaining(["BreadcrumbList", "FAQPage", "ItemList"]));
  expect(ld.join("")).not.toMatch(/AggregateRating|"Review"|ratingValue/); // no rating/review markup, ever

  // Internal links to related sections.
  for (const href of ["/calendar", "/guides", "/tutorials"]) await expect(page.locator(`main a[href="${href}"]`).first()).toBeVisible();

  const sitemap = await page.request.get("/sitemap.xml").then((r) => r.text());
  expect(sitemap).toMatch(/\/best-brokers<\/loc>/);
  expect(sitemap).toContain(`/best-brokers/${A_SLUG}`);
  expect((await page.request.get("/robots.txt").then((r) => r.text()))).not.toMatch(/Disallow:\s*\/best-brokers/);

  // The profile page has its own metadata.
  await page.goto(`/best-brokers/${A_SLUG}`);
  await expect(page).toHaveTitle(new RegExp(`${A_NAME} — Broker Profile`));
  expect(await page.locator('link[rel="canonical"]').getAttribute("href")).toMatch(new RegExp(`/best-brokers/${A_SLUG}$`));
  await context.close();
});

test("a second broker without an affiliate link or regulation says so plainly, and ranks below the first", async ({ browser }) => {
  await adminPage.goto("/admin/brokers/new");
  await adminPage.getByLabel("Broker name").fill(B_NAME);
  await adminPage.getByLabel("Official website").fill("https://www.beta-example.com");
  await adminPage.getByLabel("Key features and advantages").fill("Copy trading");
  await adminPage.getByLabel("Why we selected this broker").fill("Simple onboarding.");
  await adminPage.getByRole("checkbox", { name: "Algorithmic trading", exact: true }).check();
  await adminPage.getByRole("button", { name: "Create broker" }).click();
  await adminPage.waitForURL(/\/admin\/brokers\/[a-z0-9]+\?created=1$/, { timeout: 20_000 });
  bId = new URL(adminPage.url()).pathname.split("/").pop() ?? "";
  await adminPage.getByRole("button", { name: "Publish", exact: true }).click();
  await expect(adminPage.getByRole("button", { name: "Unpublish" })).toBeVisible({ timeout: 15_000 });

  const visitor = await browser.newContext({ baseURL: "http://localhost:3000" });
  const page = await visitor.newPage();
  expect(await publicOrder(page)).toEqual([A_NAME, B_NAME]);
  const card = page.locator(`article[aria-label="${B_NAME}"]`);
  await expect(card.getByText("Not provided").first()).toBeVisible();
  await expect(card.getByText("Not rated")).toBeVisible();
  await expect(card.getByText("No verification date recorded.")).toBeVisible();
  const visit = card.getByRole("link", { name: /^Visit Broker/ });
  await expect(visit).toHaveAttribute("href", "https://www.beta-example.com/");
  expect(((await visit.getAttribute("rel")) ?? "").split(" ")).not.toContain("sponsored");
  await expect(card.getByText("Affiliate link", { exact: true })).toHaveCount(0);
  await visitor.close();
});

test("filters only appear for what the data supports and narrow the list without renumbering", async ({ browser }) => {
  const visitor = await browser.newContext({ baseURL: "http://localhost:3000" });
  const page = await visitor.newPage();
  await page.goto("/best-brokers");
  const filters = page.getByRole("navigation", { name: "Filter brokers" });
  await expect(filters.getByRole("link", { name: /Best for beginners/ })).toBeVisible();
  await expect(filters.getByRole("link", { name: /MT4\/MT5 traders/ })).toBeVisible();
  await expect(filters.getByRole("link", { name: /Regulated brokers/ })).toBeVisible();
  await expect(filters.getByRole("link", { name: /Algorithmic trading/ })).toBeVisible();
  await expect(filters.getByRole("link", { name: /Low-spread brokers/ })).toHaveCount(0); // nobody is tagged for it

  expect(await publicOrder(page, "?filter=beginners")).toEqual([A_NAME]);
  expect(await publicOrder(page, "?filter=algorithmic-trading")).toEqual([B_NAME]);
  expect(await publicOrder(page, "?filter=regulated")).toEqual([A_NAME]);
  expect(await publicOrder(page, "?filter=made-up")).toEqual([A_NAME, B_NAME]); // unknown filter is ignored
  // Beta keeps its overall rank even when filtered alone.
  await page.goto("/best-brokers?filter=algorithmic-trading");
  const betaRank = await page.locator(`article[aria-label="${B_NAME}"]`).getByTitle(/Ranked number \d+/).getAttribute("title");
  await page.goto("/best-brokers");
  expect(await page.locator(`article[aria-label="${B_NAME}"]`).getByTitle(/Ranked number \d+/).getAttribute("title")).toBe(betaRank);
  await visitor.close();
});

test("reordering, editing and unpublishing update the public page; archive and restore work", async ({ browser }) => {
  const visitor = await browser.newContext({ baseURL: "http://localhost:3000" });
  const page = await visitor.newPage();

  // Move Beta above Alpha.
  await adminPage.goto("/admin/brokers?status=PUBLISHED");
  await adminPage.getByRole("button", { name: `Move ${B_NAME} up` }).click();
  await expect.poll(async () => publicOrder(page), { timeout: 15_000 }).toEqual([B_NAME, A_NAME]);
  // …and back, using the position field this time.
  await adminPage.goto(`/admin/brokers/${bId}`);
  await adminPage.getByLabel("Ranking position").fill("99");
  await adminPage.getByRole("button", { name: "Save broker" }).click();
  await expect(adminPage.getByRole("status")).toContainText("Saved");
  expect(await publicOrder(page)).toEqual([A_NAME, B_NAME]);

  // Edit: new tagline shows publicly.
  await adminPage.goto(`/admin/brokers/${aId}`);
  await adminPage.getByLabel("Tagline").fill("Updated tagline for the test");
  await adminPage.getByRole("button", { name: "Save broker" }).click();
  await expect(adminPage.getByRole("status")).toContainText("Saved");
  await page.goto("/best-brokers");
  await expect(page.locator(`article[aria-label="${A_NAME}"]`).getByText("Updated tagline for the test")).toBeVisible();

  // A live broker can't be edited into something unpublishable.
  await adminPage.getByLabel("Why we selected this broker").fill("");
  await adminPage.getByRole("button", { name: "Save broker" }).click();
  await expect(adminPage.getByRole("alert").filter({ hasText: "live" })).toBeVisible();
  await adminPage.reload();

  // Unpublish Beta: gone from the list and its profile 404s, but it stays in the admin list as a draft.
  await adminPage.goto("/admin/brokers");
  const row = adminPage.getByRole("row", { name: new RegExp(B_NAME) });
  await row.getByRole("button", { name: "Unpublish" }).click();
  await expect(row.getByRole("button", { name: "Publish", exact: true })).toBeVisible({ timeout: 15_000 });
  expect(await publicOrder(page)).toEqual([A_NAME]);
  expect((await page.request.get(`/best-brokers/${B_SLUG}`)).status()).toBe(404);

  // Archive then restore Beta.
  await row.getByRole("button", { name: "Archive" }).click();
  await expect(row.getByRole("button", { name: "Restore" })).toBeVisible({ timeout: 15_000 });
  await adminPage.goto("/admin/brokers?status=ARCHIVED");
  await expect(adminPage.getByRole("row", { name: new RegExp(B_NAME) })).toBeVisible();
  await adminPage.getByRole("row", { name: new RegExp(B_NAME) }).getByRole("button", { name: "Restore" }).click();
  await expect.poll(async () => (await db.broker.findUnique({ where: { slug: B_SLUG }, select: { status: true } }))?.status, { timeout: 15_000 }).toBe("DRAFT");
  await adminPage.goto("/admin/brokers?status=DRAFT");
  await expect(adminPage.getByRole("row", { name: new RegExp(B_NAME) })).toBeVisible({ timeout: 15_000 });
  await visitor.close();
});

test("unsafe or invalid links are rejected, and a broker can't be published without what the page needs", async () => {
  await adminPage.goto("/admin/brokers/new");
  await adminPage.getByLabel("Broker name").fill(`E2E Unsafe ${stamp}`);
  for (const bad of ["javascript:alert(1)", "http://insecure.example.com", "https://localhost/admin", "data:text/html,<script>alert(1)</script>"]) {
    await adminPage.getByLabel("Official website").fill(bad);
    await adminPage.getByRole("button", { name: "Create broker" }).click();
    await expect(adminPage.getByRole("alert").filter({ hasText: /Official website/ })).toBeVisible({ timeout: 10_000 });
    await expect(adminPage).toHaveURL(/\/admin\/brokers\/new$/);
  }
  await adminPage.getByLabel("Official website").fill("https://www.fine-example.com");
  await adminPage.getByLabel("Affiliate / referral link").fill("javascript:alert(document.cookie)");
  await adminPage.getByRole("button", { name: "Create broker" }).click();
  await expect(adminPage.getByRole("alert").filter({ hasText: /Affiliate/ })).toBeVisible({ timeout: 10_000 });
  expect(await db.broker.count({ where: { name: `E2E Unsafe ${stamp}` } })).toBe(0);

  // Facts without a verification date can't go public; a non-image can't be a logo.
  await adminPage.getByLabel("Affiliate / referral link").fill("");
  await adminPage.locator("#logo").setInputFiles({ name: "evil.png", mimeType: "image/png", buffer: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>') });
  await adminPage.getByRole("button", { name: "Create broker" }).click();
  await expect(adminPage.getByRole("alert").filter({ hasText: /PNG, JPG or WebP/ })).toBeVisible({ timeout: 10_000 });
  await adminPage.locator("#logo").setInputFiles([]);
  await adminPage.getByLabel("Key features and advantages").fill("A feature");
  await adminPage.getByLabel("Why we selected this broker").fill("A reason.");
  await adminPage.getByLabel("Regulation and licensing").fill("Some regulator");
  await adminPage.getByRole("button", { name: "Create broker" }).click();
  await adminPage.waitForURL(/\/admin\/brokers\/[a-z0-9]+\?created=1$/, { timeout: 20_000 });
  await adminPage.getByRole("button", { name: "Publish", exact: true }).click();
  await expect(adminPage.getByRole("alert").filter({ hasText: /verified/ })).toBeVisible({ timeout: 10_000 });
  const id = new URL(adminPage.url()).pathname.split("/").pop() ?? "";
  // Delete it again (also exercises Delete).
  adminPage.once("dialog", (d) => d.accept());
  await adminPage.getByRole("button", { name: "Delete", exact: true }).click();
  await expect.poll(() => db.broker.count({ where: { id } }), { timeout: 15_000 }).toBe(0);
});

test("only authorised administrators can manage brokers", async ({ browser }) => {
  // Signed out.
  const anon = await (await browser.newContext({ baseURL: "http://localhost:3000" })).newPage();
  await anon.goto("/admin/brokers");
  await expect(anon).toHaveURL(/\/auth\/sign-in/);
  await anon.goto("/admin/brokers/new");
  await expect(anon).toHaveURL(/\/auth\/sign-in/);

  // An ordinary member.
  const member = await signedIn(browser, "e2e-buyer@fxbotmarket.local");
  await member.goto("/admin/brokers");
  await expect(member).not.toHaveURL(/\/admin\/brokers/);

  // A legacy moderator (staff, but not an administrator) is turned away from the page and has no menu entry.
  const mod = await signedIn(browser, modEmail);
  await mod.goto("/admin/brokers");
  await expect(mod).not.toHaveURL(/\/admin\/brokers/);
  await mod.goto("/admin");
  await expect(mod.locator('a[href="/admin/brokers"]')).toHaveCount(0); // no admin menu entry
});

test("the menu bar links to Best Brokers on desktop and phone, and the page fits a phone", async ({ browser }) => {
  const desktop = await (await browser.newContext({ baseURL: "http://localhost:3000", viewport: { width: 1440, height: 900 } })).newPage();
  await desktop.goto("/");
  await desktop.getByRole("navigation", { name: "Primary" }).getByRole("link", { name: "Best Brokers", exact: true }).click();
  await expect(desktop).toHaveURL(/\/best-brokers$/);

  const context = await browser.newContext({ baseURL: "http://localhost:3000", viewport: { width: 375, height: 812 } });
  const phone = await context.newPage();
  await phone.goto("/");
  await phone.getByRole("button", { name: "Toggle menu" }).click();
  await phone.locator("header").locator("div.xl\\:hidden").getByRole("link", { name: "Best Brokers", exact: true }).click();
  await expect(phone).toHaveURL(/\/best-brokers$/);
  await expect(phone.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(phone.locator(`article[aria-label="${A_NAME}"]`)).toBeVisible();
  // No sideways page scroll: the comparison table scrolls inside its own region.
  const overflow = await phone.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(1);
  await expect(phone.getByRole("region", { name: /Broker comparison table/ })).toBeVisible();
  await context.close();
});

test("cleanup: deleting from the admin list removes a broker and renumbers the rest", async () => {
  await adminPage.goto("/admin/brokers");
  for (const name of [B_NAME, A_NAME]) {
    const row = adminPage.getByRole("row", { name: new RegExp(name) });
    adminPage.once("dialog", (d) => d.accept());
    await row.getByRole("button", { name: "Delete" }).click();
    await expect(adminPage.getByRole("row", { name: new RegExp(name) })).toHaveCount(0, { timeout: 15_000 });
  }
  expect(await db.broker.count({ where: { slug: { in: [A_SLUG, B_SLUG] } } })).toBe(0);
  const log = await db.auditLog.count({ where: { entityType: "Broker", action: { in: ["broker.create", "broker.publish", "broker.delete"] }, createdAt: { gte: new Date(stamp) } } });
  expect(log).toBeGreaterThanOrEqual(6);
});
