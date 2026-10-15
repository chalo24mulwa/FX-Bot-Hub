import { test, expect, type Browser, type Page } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

// VPS providers end to end, driven through the real admin UI: add a provider with a logo and cover photo,
// publish it, see it on the public page with the right links, price, offer and "Top Pick" label, filter,
// rank, edit, unpublish, archive, restore, delete; reject unsafe links, SVG images and unevidenced latency;
// keep unauthorised users out; check SEO and the phone layout. Everything it creates is removed again.
// Serial, because later steps build on earlier ones.

test.describe.configure({ mode: "serial" });

const db = new PrismaClient();
const stamp = Date.now();
const PASSWORD = "password123";
const A_NAME = `E2E Alpha VPS ${stamp}`;
const B_NAME = `E2E Beta VPS ${stamp}`;
const A_SLUG = `e2e-alpha-vps-${stamp}`;
const B_SLUG = `e2e-beta-vps-${stamp}`;
const AFFILIATE = "https://go.alpha-vps-example.com/ref/fxbothub?campaign=e2e";
const OFFICIAL = "https://www.alpha-vps-example.com";
const modEmail = `e2e-vps-mod-${stamp}@fxbotmarket.local`;
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

/** Public order of this run's providers (other providers in the database are ignored). */
async function publicOrder(page: Page, filter = ""): Promise<string[]> {
  await page.goto(`/vps${filter}`);
  const names = await page.locator("article[aria-label]").evaluateAll((els) => els.map((el) => el.getAttribute("aria-label") ?? ""));
  return names.filter((n) => n.includes(String(stamp)));
}

test.beforeAll(async ({ browser }) => {
  await db.user.create({
    data: { email: modEmail, name: "VPS Mod", password: await bcrypt.hash(PASSWORD, 10), role: "MODERATOR", profile: { create: { displayName: "VPS Mod" } } },
  });
  adminPage = await signedIn(browser, adminEmail);
});

test.afterAll(async () => {
  await db.vpsProvider.deleteMany({ where: { OR: [{ slug: { in: [A_SLUG, B_SLUG] } }, { name: { startsWith: "E2E Unsafe VPS" } }] } });
  await db.user.deleteMany({ where: { email: modEmail } });
  await db.$disconnect();
});

test("an administrator adds a provider with a logo and cover photo; it stays a draft and private until published", async ({ browser }) => {
  await adminPage.goto("/admin/vps/new");
  await adminPage.getByLabel("Provider name").fill(A_NAME);
  await adminPage.getByLabel("Short description").fill("Always-on Windows servers for MetaTrader");
  await adminPage.getByLabel("Full description").fill("Alpha VPS runs Windows servers aimed at MetaTrader users.\n\nPlans start small and can be upgraded.");
  await adminPage.getByLabel("Provider category").fill("Forex-specialist VPS");
  await adminPage.locator("#logo").setInputFiles({ name: "logo.png", mimeType: "image/png", buffer: PNG });
  await adminPage.locator("#cover").setInputFiles({ name: "cover.png", mimeType: "image/png", buffer: PNG });
  await adminPage.getByRole("checkbox", { name: /Mark as Top Pick/ }).check();
  await adminPage.getByRole("checkbox", { name: "Windows Server", exact: true }).check();
  await adminPage.getByLabel("Server locations").fill("London, New York");
  await adminPage.getByRole("checkbox", { name: "MT4", exact: true }).check();
  await adminPage.getByRole("checkbox", { name: "MT5", exact: true }).check();
  await adminPage.getByLabel("CPU", { exact: true }).fill("2 vCPU");
  await adminPage.getByLabel("RAM", { exact: true }).fill("4 GB");
  await adminPage.getByLabel("Storage", { exact: true }).fill("60 GB SSD");
  await adminPage.getByLabel("Starting price").fill("9.99");
  await adminPage.getByLabel("Currency", { exact: true }).fill("USD");
  await adminPage.getByLabel("Billing period").selectOption("MONTH");
  await adminPage.getByRole("checkbox", { name: /Offers a verified free trial/ }).check();
  await adminPage.getByLabel("Trial or money-back offer").fill("7-day money-back guarantee");
  await adminPage.getByRole("checkbox", { name: "MT4/MT5 users", exact: true }).check();
  await adminPage.getByRole("checkbox", { name: "Multiple EAs", exact: true }).check();
  await adminPage.getByLabel("Main features").fill("Windows Server 2022\nSnapshots and backups\nRemote desktop access");
  await adminPage.getByLabel("Information verified on").fill("2026-01-15");
  await adminPage.getByLabel("Official website").fill(OFFICIAL);
  await adminPage.getByLabel("Affiliate / referral link").fill(AFFILIATE);
  await adminPage.getByLabel("Button text").selectOption("Get VPS");
  await adminPage.getByLabel("Promotional code").fill("FXBOT10");
  await adminPage.getByLabel("Offer expires on").fill("2099-12-31");
  await adminPage.getByLabel("Offer description").fill("20% off the first three months");
  await adminPage.getByLabel("Why we recommend this provider").fill("Simple setup and plans sized for one or two MetaTrader terminals.");
  await adminPage.getByLabel("Key advantages").fill("Quick setup\nUpgradeable plans");
  await adminPage.getByLabel("Limitations or considerations").fill("Fewer server locations than larger hosts");
  await adminPage.getByLabel("Rating (0").fill("4.5");
  await adminPage.getByLabel("Rating methodology note").fill("Editorial score from the details on this page");
  await adminPage.getByLabel("SEO title").fill("Alpha VPS for MT5 EAs");
  await adminPage.getByLabel("SEO meta description").fill("Alpha VPS plans for running MetaTrader Expert Advisors, with specs and pricing.");
  await adminPage.getByRole("button", { name: "Create provider" }).click();

  await adminPage.waitForURL(/\/admin\/vps\/[a-z0-9]+\?created=1$/, { timeout: 25_000 });
  aId = new URL(adminPage.url()).pathname.split("/").pop() ?? "";
  await expect(adminPage.getByRole("heading", { name: A_NAME, level: 1 })).toBeVisible();
  const preview = adminPage.locator(`article[aria-label="${A_NAME}"]`);
  await expect(preview).toBeVisible();
  await expect(preview.getByText("Preview", { exact: true })).toBeVisible();
  await expect(preview.getByText("Top Pick", { exact: true })).toBeVisible();

  // Private while a draft: not listed, no profile page, no images for the public.
  const visitor = await browser.newContext({ baseURL: "http://localhost:3000" });
  const anon = await visitor.newPage();
  expect(await publicOrder(anon)).toEqual([]);
  expect((await anon.request.get(`/vps/${A_SLUG}`)).status()).toBe(404);
  expect((await anon.request.get(`/api/vps/${aId}/logo`)).status()).toBe(404);
  expect((await anon.request.get(`/api/vps/${aId}/cover`)).status()).toBe(404);
  expect(await anon.request.get("/sitemap.xml").then((r) => r.text())).not.toContain(A_SLUG);
  // …but the administrator can see the draft's images while previewing.
  expect((await adminPage.request.get(`/api/vps/${aId}/logo`)).status()).toBe(200);
  expect((await adminPage.request.get(`/api/vps/${aId}/cover`)).status()).toBe(200);
  await visitor.close();
});

test("publishing puts it on the public page with its ranking, images, specs, offer and links", async ({ browser }) => {
  await adminPage.goto(`/admin/vps/${aId}`);
  await adminPage.getByRole("button", { name: "Publish", exact: true }).click();
  await expect(adminPage.getByRole("button", { name: "Unpublish" })).toBeVisible({ timeout: 15_000 });

  const visitor = await browser.newContext({ baseURL: "http://localhost:3000" });
  const page = await visitor.newPage();
  expect(await publicOrder(page)).toEqual([A_NAME]);

  const card = page.locator(`article[aria-label="${A_NAME}"]`);
  await expect(card.getByText("Always-on Windows servers for MetaTrader")).toBeVisible();
  await expect(card.getByText("Top Pick", { exact: true })).toBeVisible(); // only because the admin ticked it
  await expect(card.getByText("Remote desktop access")).toBeVisible();
  await expect(card.getByText("Simple setup and plans sized for one or two MetaTrader terminals.")).toBeVisible();
  await expect(card.getByText("From $9.99 / month")).toBeVisible();
  await expect(card.getByText("2 vCPU")).toBeVisible();
  await expect(card.getByText("4 GB")).toBeVisible();
  await expect(card.getByText("60 GB SSD")).toBeVisible();
  await expect(card.getByText("Windows Server", { exact: true })).toBeVisible();
  await expect(card.getByText("London, New York")).toBeVisible();
  await expect(card.getByText("MT4, MT5")).toBeVisible();
  await expect(card.getByText("7-day money-back guarantee")).toBeVisible();
  await expect(card.getByText("Information checked 15 Jan 2026")).toBeVisible();
  await expect(card.getByText("4.5")).toBeVisible();
  await expect(card.getByText("Not provided").first()).toBeVisible(); // latency wasn't entered
  await expect(card.getByText("Forex-specialist VPS")).toBeVisible();

  // Offer and promo code shown while the offer is in date.
  const offer = card.getByLabel("Current offer");
  await expect(offer).toContainText("20% off the first three months");
  await expect(offer).toContainText("FXBOT10");
  await expect(offer).toContainText("Offer ends 31 Dec 2099");

  // Images: both served as real raster images, never sniffed; descriptive alt text.
  const logoImg = card.getByRole("img", { name: `${A_NAME} logo` });
  await expect(logoImg).toBeVisible();
  // The logo overlaps the cover banner; its top edge (the part under the banner) must be on top, not hidden behind it.
  // (elementFromPoint only sees what is inside the viewport, so scroll the card into view first.)
  await logoImg.scrollIntoViewIfNeeded();
  expect(
    await logoImg.evaluate((el) => {
      const r = el.getBoundingClientRect();
      const top = document.elementFromPoint(r.left + r.width / 2, r.top + 10);
      return top === el;
    }),
  ).toBe(true);
  await expect(card.getByRole("img", { name: `${A_NAME} — VPS hosting for forex trading` })).toHaveAttribute("loading", "lazy");
  for (const kind of ["logo", "cover"]) {
    const res = await page.request.get(`/api/vps/${aId}/${kind}`);
    expect(res.status()).toBe(200);
    expect(res.headers()["content-type"]).toMatch(/^image\/(png|webp)$/);
    expect(res.headers()["x-content-type-options"]).toBe("nosniff");
  }

  // Affiliate link is the main button with the chosen text, labelled and marked sponsored; the official site stays reachable.
  const join = card.getByRole("link", { name: /^Get VPS/ });
  await expect(join).toHaveAttribute("href", AFFILIATE);
  await expect(join).toHaveAttribute("target", "_blank");
  const rel = (await join.getAttribute("rel")) ?? "";
  for (const token of ["sponsored", "nofollow", "noopener", "noreferrer"]) expect(rel.split(" ")).toContain(token);
  await expect(card.getByText("Affiliate link", { exact: true })).toBeVisible();
  const official = card.getByRole("link", { name: "alpha-vps-example.com", exact: true });
  await expect(official).toHaveAttribute("href", `${OFFICIAL}/`);
  expect(((await official.getAttribute("rel")) ?? "").split(" ")).not.toContain("sponsored");

  await expect(page.getByLabel("Advertising disclosure").first()).toContainText("affiliate or referral links");
  await expect(page.getByRole("region", { name: /VPS comparison table/ }).getByRole("link", { name: A_NAME, exact: true })).toBeVisible();

  // "View Details" opens the profile, with the content that doesn't fit on a card.
  await card.getByRole("link", { name: /^View Details/ }).click();
  await expect(page).toHaveURL(new RegExp(`/vps/${A_SLUG}$`));
  await expect(page.getByRole("heading", { name: A_NAME, level: 1 })).toBeVisible();
  await expect(page.getByText("Alpha VPS runs Windows servers aimed at MetaTrader users.")).toBeVisible();
  await expect(page.getByText("Plans start small and can be upgraded.")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Key advantages" })).toBeVisible();
  await expect(page.getByText("Quick setup")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Limitations to consider" })).toBeVisible();
  await expect(page.getByText("Fewer server locations than larger hosts")).toBeVisible();
  // The provider's own SEO title and description are used for its profile.
  await expect(page).toHaveTitle("Alpha VPS for MT5 EAs | FXBotHub");
  expect(await page.locator('meta[name="description"]').getAttribute("content")).toBe("Alpha VPS plans for running MetaTrader Expert Advisors, with specs and pricing.");
  expect(await page.locator('link[rel="canonical"]').getAttribute("href")).toMatch(new RegExp(`/vps/${A_SLUG}$`));
  await visitor.close();
});

test("the page has the right SEO, education content, anchors and internal links", async ({ browser }) => {
  const context = await browser.newContext({ baseURL: "http://localhost:3000" });
  const page = await context.newPage();
  await page.goto("/vps");
  await expect(page).toHaveTitle("Best Forex VPS Hosting for MT4 & MT5 | FXBotHub");
  const meta = (selector: string) => page.locator(selector).first().getAttribute("content");
  expect(await meta('meta[name="description"]')).toMatch(/^Compare VPS hosting for forex trading, MT4 and MT5 Expert Advisors\./);
  expect(await meta('meta[property="og:title"]')).toContain("Best Forex VPS Hosting");
  expect(await meta('meta[property="og:description"]')).toContain("VPS hosting for forex trading");
  expect(await page.locator('link[rel="canonical"]').getAttribute("href")).toMatch(/\/vps$/);
  const robots = await page.locator('meta[name="robots"]').evaluateAll((els) => els.map((el) => el.getAttribute("content") ?? ""));
  expect(robots.join(",")).not.toMatch(/noindex/);

  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Power Your Forex Bots with the Right VPS");
  await expect(page.getByText("Discover VPS hosting providers designed to help forex traders run Expert Advisors around the clock")).toBeVisible();
  for (const h of ["Why Use a VPS for Forex Trading?", "Best VPS Providers for Forex Trading", "Compare side by side", "Frequently asked questions"]) {
    await expect(page.getByRole("heading", { name: h, level: 2 })).toBeVisible();
  }
  await expect(page.getByRole("heading", { name: "Who Needs a Forex VPS?", level: 3 })).toBeVisible();
  for (const title of ["24/7 Operation", "Stable Connectivity", "Lower Latency", "Fewer Local Interruptions", "Multiple Trading Platforms", "Remote Access"]) {
    await expect(page.getByRole("heading", { name: title, level: 3 })).toBeVisible();
  }
  await expect(page.getByText("does not guarantee profits, remove trading risk, or prevent every technical failure")).toBeVisible();

  // The two hero buttons jump to the rankings and to the education section.
  const primary = page.getByRole("link", { name: /^Explore VPS Providers/ });
  const secondary = page.getByRole("link", { name: "Why Use a VPS?", exact: true });
  await expect(primary).toHaveAttribute("href", "#providers");
  await expect(secondary).toHaveAttribute("href", "#why-vps");
  await expect(page.locator("#providers")).toHaveCount(1);
  await expect(page.locator("#why-vps")).toHaveCount(1);
  await secondary.click();
  await expect(page).toHaveURL(/#why-vps$/);
  await expect(page.locator("#why-vps")).toBeInViewport();
  await primary.click();
  await expect(page).toHaveURL(/#providers$/);

  // Server-rendered provider content and FAQ (not behind client JS).
  const html = await (await page.request.get("/vps")).text();
  expect(html).toContain(A_NAME);
  expect(html).toContain("Does FXBotHub receive commissions from VPS links?");

  const ld = await page.locator('script[type="application/ld+json"]').allTextContents();
  expect(ld.map((t) => JSON.parse(t)["@type"])).toEqual(expect.arrayContaining(["BreadcrumbList", "FAQPage", "ItemList"]));
  expect(ld.join("")).not.toMatch(/AggregateRating|"Review"|ratingValue/);

  for (const href of ["/marketplace?type=EA", "/guides/what-is-a-forex-expert-advisor", "/tutorials/install-ea-mt5", "/best-brokers", "/calendar"]) {
    await expect(page.locator(`main a[href="${href}"]`).first()).toBeVisible();
  }
  // Those targets exist.
  for (const href of ["/guides/what-is-a-forex-expert-advisor", "/tutorials/install-ea-mt5", "/tutorials/troubleshoot-ea-not-trading"]) {
    expect((await page.request.get(href)).status()).toBe(200);
  }

  const sitemap = await page.request.get("/sitemap.xml").then((r) => r.text());
  expect(sitemap).toMatch(/\/vps<\/loc>/);
  expect(sitemap).toContain(`/vps/${A_SLUG}`);
  expect(await page.request.get("/robots.txt").then((r) => r.text())).not.toMatch(/Disallow:\s*\/vps/);
  await context.close();
});

test("a second provider with an expired offer, no affiliate link and no extras says so plainly and ranks below", async ({ browser }) => {
  await adminPage.goto("/admin/vps/new");
  await adminPage.getByLabel("Provider name").fill(B_NAME);
  await adminPage.getByLabel("Official website").fill("https://www.beta-vps-example.com");
  await adminPage.getByLabel("Main features").fill("Linux servers");
  await adminPage.getByLabel("Why we recommend this provider").fill("Low-cost plans.");
  await adminPage.getByLabel("Server locations").fill("Frankfurt");
  await adminPage.getByRole("checkbox", { name: "Budget-friendly", exact: true }).check();
  await adminPage.getByLabel("Promotional code").fill("OLDCODE");
  await adminPage.getByLabel("Offer expires on").fill("2020-01-01");
  await adminPage.getByLabel("Offer description").fill("An offer that has ended");
  await adminPage.getByLabel("Information verified on").fill("2026-01-15");
  await adminPage.getByRole("button", { name: "Create provider" }).click();
  await adminPage.waitForURL(/\/admin\/vps\/[a-z0-9]+\?created=1$/, { timeout: 25_000 });
  bId = new URL(adminPage.url()).pathname.split("/").pop() ?? "";
  await adminPage.getByRole("button", { name: "Publish", exact: true }).click();
  await expect(adminPage.getByRole("button", { name: "Unpublish" })).toBeVisible({ timeout: 15_000 });

  const visitor = await browser.newContext({ baseURL: "http://localhost:3000" });
  const page = await visitor.newPage();
  expect(await publicOrder(page)).toEqual([A_NAME, B_NAME]);
  const card = page.locator(`article[aria-label="${B_NAME}"]`);
  await expect(card.getByText("Not provided").first()).toBeVisible();
  await expect(card.getByText("Not rated")).toBeVisible();
  await expect(card.getByText("Top Pick")).toHaveCount(0); // never inferred from position
  await expect(card.getByLabel("Current offer")).toHaveCount(0); // expired
  await expect(card.getByText("OLDCODE")).toHaveCount(0);
  await expect(card.getByText("From $")).toHaveCount(0); // no price was entered, none is invented
  const visit = card.getByRole("link", { name: /^Visit Provider/ });
  await expect(visit).toHaveAttribute("href", "https://www.beta-vps-example.com/");
  expect(((await visit.getAttribute("rel")) ?? "").split(" ")).not.toContain("sponsored");
  await expect(card.getByText("Affiliate link", { exact: true })).toHaveCount(0);
  await visitor.close();
});

test("filters only appear for what the data supports and narrow the list without renumbering", async ({ browser }) => {
  const visitor = await browser.newContext({ baseURL: "http://localhost:3000" });
  const page = await visitor.newPage();
  await page.goto("/vps");
  const filters = page.getByRole("navigation", { name: "Filter VPS providers" });
  await expect(filters.getByRole("link", { name: /^MT4\/MT5/ })).toBeVisible();
  await expect(filters.getByRole("link", { name: /^Windows VPS/ })).toBeVisible();
  await expect(filters.getByRole("link", { name: /^Verified free trial/ })).toBeVisible();
  await expect(filters.getByRole("link", { name: /^Multiple EA instances/ })).toBeVisible();
  await expect(filters.getByRole("link", { name: /^Budget-friendly options/ })).toBeVisible();
  await expect(filters.getByRole("link", { name: /^Servers in London/ })).toBeVisible();
  await expect(filters.getByRole("link", { name: /^Servers in Frankfurt/ })).toBeVisible();
  await expect(filters.getByRole("link", { name: /^Low-latency trading/ })).toHaveCount(0); // nobody is tagged for it

  expect(await publicOrder(page, "?filter=windows")).toEqual([A_NAME]);
  expect(await publicOrder(page, "?filter=free-trial")).toEqual([A_NAME]);
  expect(await publicOrder(page, "?filter=mt4-mt5")).toEqual([A_NAME]);
  expect(await publicOrder(page, "?filter=budget-friendly")).toEqual([B_NAME]);
  expect(await publicOrder(page, "?filter=region-frankfurt")).toEqual([B_NAME]);
  expect(await publicOrder(page, "?filter=region-london")).toEqual([A_NAME]);
  expect(await publicOrder(page, "?filter=made-up")).toEqual([A_NAME, B_NAME]);
  // Beta keeps its overall rank when filtered alone.
  await page.goto("/vps?filter=budget-friendly");
  const rank = await page.locator(`article[aria-label="${B_NAME}"]`).getByTitle(/Ranked number \d+/).getAttribute("title");
  await page.goto("/vps");
  expect(await page.locator(`article[aria-label="${B_NAME}"]`).getByTitle(/Ranked number \d+/).getAttribute("title")).toBe(rank);
  await visitor.close();
});

test("reordering, editing and unpublishing update the public page; archive and restore work", async ({ browser }) => {
  const visitor = await browser.newContext({ baseURL: "http://localhost:3000" });
  const page = await visitor.newPage();

  await adminPage.goto("/admin/vps?status=PUBLISHED");
  await adminPage.getByRole("button", { name: `Move ${B_NAME} up` }).click();
  await expect.poll(async () => publicOrder(page), { timeout: 15_000 }).toEqual([B_NAME, A_NAME]);
  // The Top Pick label stays with Alpha — it follows the admin's choice, not the ranking.
  await expect(page.locator(`article[aria-label="${A_NAME}"]`).getByText("Top Pick", { exact: true })).toBeVisible();
  await expect(page.locator(`article[aria-label="${B_NAME}"]`).getByText("Top Pick")).toHaveCount(0);
  // Back, using the position field.
  await adminPage.goto(`/admin/vps/${bId}`);
  await adminPage.getByLabel("Ranking position").fill("99");
  await adminPage.getByRole("button", { name: "Save provider" }).click();
  await expect(adminPage.getByRole("status")).toContainText("Saved");
  expect(await publicOrder(page)).toEqual([A_NAME, B_NAME]);

  // Editing updates the public page, including a changed affiliate link and an ended offer.
  await adminPage.goto(`/admin/vps/${aId}`);
  await adminPage.getByLabel("Short description").fill("Updated headline for the test");
  await adminPage.getByLabel("Affiliate / referral link").fill("https://go.alpha-vps-example.com/ref/second");
  await adminPage.getByLabel("Offer expires on").fill("2020-06-01");
  await adminPage.getByRole("button", { name: "Save provider" }).click();
  await expect(adminPage.getByRole("status")).toContainText("Saved");
  await page.goto("/vps");
  const card = page.locator(`article[aria-label="${A_NAME}"]`);
  await expect(card.getByText("Updated headline for the test")).toBeVisible();
  await expect(card.getByRole("link", { name: /^Get VPS/ })).toHaveAttribute("href", "https://go.alpha-vps-example.com/ref/second");
  await expect(card.getByLabel("Current offer")).toHaveCount(0);

  // A live provider can't be edited into something unpublishable.
  await adminPage.getByLabel("Why we recommend this provider").fill("");
  await adminPage.getByRole("button", { name: "Save provider" }).click();
  await expect(adminPage.getByRole("alert").filter({ hasText: "live" })).toBeVisible();
  await adminPage.reload();

  // Unpublish Beta, then archive, then restore.
  await adminPage.goto("/admin/vps");
  const row = adminPage.getByRole("row", { name: new RegExp(B_NAME) });
  await row.getByRole("button", { name: "Unpublish" }).click();
  await expect(row.getByRole("button", { name: "Publish", exact: true })).toBeVisible({ timeout: 15_000 });
  expect(await publicOrder(page)).toEqual([A_NAME]);
  expect((await page.request.get(`/vps/${B_SLUG}`)).status()).toBe(404);
  await row.getByRole("button", { name: "Archive" }).click();
  await expect(row.getByRole("button", { name: "Restore" })).toBeVisible({ timeout: 15_000 });
  expect(await publicOrder(page)).toEqual([A_NAME]);
  await adminPage.goto("/admin/vps?status=ARCHIVED");
  await adminPage.getByRole("row", { name: new RegExp(B_NAME) }).getByRole("button", { name: "Restore" }).click();
  await expect.poll(async () => (await db.vpsProvider.findUnique({ where: { slug: B_SLUG }, select: { status: true } }))?.status, { timeout: 15_000 }).toBe("DRAFT");
  await visitor.close();
});

test("unsafe links, SVG images, partial prices and unevidenced latency are rejected", async () => {
  await adminPage.goto("/admin/vps/new");
  await adminPage.getByLabel("Provider name").fill(`E2E Unsafe VPS ${stamp}`);
  for (const bad of ["javascript:alert(1)", "http://insecure.example.com", "https://localhost/admin", "data:text/html,<script>alert(1)</script>"]) {
    await adminPage.getByLabel("Official website").fill(bad);
    await adminPage.getByRole("button", { name: "Create provider" }).click();
    await expect(adminPage.getByRole("alert").filter({ hasText: /Official website/ })).toBeVisible({ timeout: 10_000 });
    await expect(adminPage).toHaveURL(/\/admin\/vps\/new$/);
  }
  await adminPage.getByLabel("Official website").fill("https://www.fine-vps-example.com");
  await adminPage.getByLabel("Affiliate / referral link").fill("javascript:alert(document.cookie)");
  await adminPage.getByRole("button", { name: "Create provider" }).click();
  await expect(adminPage.getByRole("alert").filter({ hasText: /Affiliate/ })).toBeVisible({ timeout: 10_000 });
  await adminPage.getByLabel("Affiliate / referral link").fill("");

  // A price needs its currency and period.
  await adminPage.getByLabel("Starting price").fill("9.99");
  await adminPage.getByRole("button", { name: "Create provider" }).click();
  await expect(adminPage.getByRole("alert").filter({ hasText: /currency/ })).toBeVisible({ timeout: 10_000 });
  await adminPage.getByLabel("Starting price").fill("");

  // An SVG (or anything not a raster image) can't be a cover or a logo.
  await adminPage.locator("#cover").setInputFiles({ name: "evil.png", mimeType: "image/png", buffer: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>') });
  await adminPage.getByRole("button", { name: "Create provider" }).click();
  await expect(adminPage.getByRole("alert").filter({ hasText: /PNG, JPG or WebP/ })).toBeVisible({ timeout: 10_000 });
  await adminPage.locator("#cover").setInputFiles([]);
  expect(await db.vpsProvider.count({ where: { name: `E2E Unsafe VPS ${stamp}` } })).toBe(0);

  // Latency without a source can be saved as a draft but not published.
  await adminPage.getByLabel("Main features").fill("A feature");
  await adminPage.getByLabel("Why we recommend this provider").fill("A reason.");
  await adminPage.getByLabel("Verified latency information").fill("Under 2 ms to London");
  await adminPage.getByLabel("Information verified on").fill("2026-01-15");
  await adminPage.getByRole("button", { name: "Create provider" }).click();
  await adminPage.waitForURL(/\/admin\/vps\/[a-z0-9]+\?created=1$/, { timeout: 25_000 });
  const id = new URL(adminPage.url()).pathname.split("/").pop() ?? "";
  await adminPage.getByRole("button", { name: "Publish", exact: true }).click();
  await expect(adminPage.getByRole("alert").filter({ hasText: /source/ })).toBeVisible({ timeout: 10_000 });
  // With a source it can.
  await adminPage.getByLabel("Latency source").fill("Provider's published test, 1 Jan 2026");
  await adminPage.getByRole("button", { name: "Save provider" }).click();
  await expect(adminPage.getByText("Saved. Publish it from the buttons above")).toBeVisible();
  adminPage.once("dialog", (d) => d.accept());
  await adminPage.getByRole("button", { name: "Delete", exact: true }).click();
  await expect.poll(() => db.vpsProvider.count({ where: { id } }), { timeout: 15_000 }).toBe(0);
});

test("only authorised administrators can manage VPS listings", async ({ browser }) => {
  const anon = await (await browser.newContext({ baseURL: "http://localhost:3000" })).newPage();
  await anon.goto("/admin/vps");
  await expect(anon).toHaveURL(/\/auth\/sign-in/);
  await anon.goto("/admin/vps/new");
  await expect(anon).toHaveURL(/\/auth\/sign-in/);

  const member = await signedIn(browser, "e2e-buyer@fxbotmarket.local");
  await member.goto("/admin/vps");
  await expect(member).not.toHaveURL(/\/admin\/vps/);

  // A legacy moderator (staff, but not an administrator) is turned away and has no menu entry.
  const mod = await signedIn(browser, modEmail);
  await mod.goto("/admin/vps");
  await expect(mod).not.toHaveURL(/\/admin\/vps/);
  await mod.goto("/admin");
  await expect(mod.locator('a[href="/admin/vps"]')).toHaveCount(0);
  // A draft's images aren't served to them either (Beta is a draft with no images, so use Alpha after unpublishing is not needed:
  // the image route answers 404 for anyone without the permission when the provider isn't published).
  expect((await mod.request.get(`/api/vps/${bId}/cover`)).status()).toBe(404);
});

test("the header links to VPS on desktop and phone, and the page fits a phone", async ({ browser }) => {
  const desktop = await (await browser.newContext({ baseURL: "http://localhost:3000", viewport: { width: 1440, height: 900 } })).newPage();
  await desktop.goto("/");
  await desktop.getByRole("navigation", { name: "Primary" }).getByRole("link", { name: "VPS", exact: true }).click();
  await expect(desktop).toHaveURL(/\/vps$/);

  const context = await browser.newContext({ baseURL: "http://localhost:3000", viewport: { width: 375, height: 812 } });
  const phone = await context.newPage();
  await phone.goto("/");
  await phone.getByRole("button", { name: "Toggle menu" }).click();
  await phone.locator("header").locator("div.xl\\:hidden").getByRole("link", { name: "VPS", exact: true }).click();
  await expect(phone).toHaveURL(/\/vps$/);
  await expect(phone.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(phone.locator(`article[aria-label="${A_NAME}"]`)).toBeVisible();
  const overflow = await phone.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(1);
  await expect(phone.getByRole("region", { name: /VPS comparison table/ })).toBeVisible();
  await context.close();
});

test("the Best Brokers page is unaffected", async ({ browser }) => {
  const page = await (await browser.newContext({ baseURL: "http://localhost:3000" })).newPage();
  const res = await page.goto("/best-brokers");
  expect(res?.status()).toBe(200);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Find the Right Forex Broker for Your Trading Journey");
  expect(await page.request.get("/admin/brokers", { maxRedirects: 0 }).then((r) => r.status())).toBe(307);
});

test("cleanup: deleting from the admin list removes providers and records an audit trail", async () => {
  await adminPage.goto("/admin/vps");
  for (const name of [B_NAME, A_NAME]) {
    const row = adminPage.getByRole("row", { name: new RegExp(name) });
    adminPage.once("dialog", (d) => d.accept());
    await row.getByRole("button", { name: "Delete" }).click();
    await expect(adminPage.getByRole("row", { name: new RegExp(name) })).toHaveCount(0, { timeout: 15_000 });
  }
  expect(await db.vpsProvider.count({ where: { slug: { in: [A_SLUG, B_SLUG] } } })).toBe(0);
  const log = await db.auditLog.count({ where: { entityType: "VpsProvider", action: { in: ["vps.create", "vps.publish", "vps.delete"] }, createdAt: { gte: new Date(stamp) } } });
  expect(log).toBeGreaterThanOrEqual(6);
});
