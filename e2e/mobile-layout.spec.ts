import { test, expect, type Browser, type Page } from "@playwright/test";
import { signIn, E2E_ADMIN, E2E_BUYER, E2E_SELLER } from "./helpers";

// Phone layout across the site: no page may scroll sideways at common phone widths, data tables must show every
// column (as labelled cards) instead of hiding them behind a sideways scroll, and tablets/desktops must keep their
// original layout. The page lists are samples of every kind of screen: public, account, seller and admin.

const BASE = "http://localhost:3000";
const PHONE_WIDTHS = [320, 375, 390, 430];

const PUBLIC_PAGES = [
  "/", "/marketplace", "/marketplace?platform=MT4&type=EA", "/calendar", "/calendar/usd", "/news", "/signals", "/intelligence", "/community", "/community/search?q=nfp",
  "/guides", "/guides/what-is-a-forex-expert-advisor", "/tutorials", "/tutorials/install-ea-mt5", "/developer-resources", "/partnership", "/partnership/terms", "/best-brokers", "/vps",
  "/cart", "/auth/sign-in", "/auth/sign-up", "/auth/forgot-password",
];
const ACCOUNT_PAGES = ["/dashboard", "/dashboard/orders", "/dashboard/licenses", "/dashboard/favorites", "/dashboard/alerts", "/dashboard/security", "/dashboard/partnership", "/dashboard/partnership/commissions", "/community/new"];
const SELLER_PAGES = ["/seller", "/seller/products", "/seller/products/new", "/seller/orders", "/seller/analytics", "/seller/customers", "/seller/payout", "/seller/profile"];
const ADMIN_PAGES = [
  "/admin", "/admin/users", "/admin/products", "/admin/news", "/admin/calendar", "/admin/data-sources", "/admin/finance", "/admin/audit-logs", "/admin/partnership", "/admin/partnership/commissions",
  "/admin/partnership/payouts", "/admin/community/posts", "/admin/brokers", "/admin/brokers/new", "/admin/vps/new", "/admin/queues", "/admin/refunds", "/admin/settings",
];

async function phone(browser: Browser, width: number, height = 800): Promise<Page> {
  const context = await browser.newContext({ baseURL: BASE, viewport: { width, height } });
  return context.newPage();
}

const sideways = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);

/** Elements that poke past the screen edge and are not inside a deliberate scroll container. */
const offenders = (page: Page) =>
  page.evaluate(() => {
    const vw = window.innerWidth;
    const inScroller = (el: Element) => {
      for (let q = el.parentElement; q && q !== document.body; q = q.parentElement) {
        const o = getComputedStyle(q).overflowX;
        if (o === "auto" || o === "scroll") return true;
      }
      return false;
    };
    return [...document.querySelectorAll("body *")]
      .filter((el) => {
        const cs = getComputedStyle(el);
        const r = el.getBoundingClientRect();
        if (cs.display === "none" || cs.visibility === "hidden" || cs.position === "fixed" || r.width === 0) return false;
        if (cs.position === "absolute" && r.width <= 1) return false; // sr-only helpers
        return r.right > vw + 1 && !inScroller(el);
      })
      .slice(0, 5)
      .map((el) => `${el.tagName.toLowerCase()}.${String(el.className).slice(0, 50)}`);
  });

async function checkPages(browser: Browser, pages: string[], width: number, who?: string) {
  const page = await phone(browser, width);
  if (who) await signIn(page, who);
  const failures: string[] = [];
  for (const route of pages) {
    await page.goto(route, { waitUntil: "load" });
    await page.waitForTimeout(250);
    const over = await sideways(page);
    if (over > 0) failures.push(`${route}: ${over}px sideways (${(await offenders(page)).join(", ")})`);
  }
  await page.context().close();
  expect(failures, `${width}px`).toEqual([]);
}

for (const width of PHONE_WIDTHS) {
  test(`public pages never scroll sideways at ${width}px`, async ({ browser }) => {
    test.setTimeout(180_000);
    await checkPages(browser, PUBLIC_PAGES, width);
  });
}

test("account, seller and admin pages never scroll sideways at 320px and 390px", async ({ browser }) => {
  test.setTimeout(300_000);
  for (const width of [320, 390]) {
    await checkPages(browser, ACCOUNT_PAGES, width, E2E_BUYER);
    await checkPages(browser, SELLER_PAGES, width, E2E_SELLER);
    await checkPages(browser, ADMIN_PAGES, width, E2E_ADMIN);
  }
});

test("on a phone, a data table shows every column as a labelled card; on a tablet it is still a table", async ({ browser }) => {
  const mobile = await phone(browser, 390);
  await signIn(mobile, E2E_ADMIN);
  await mobile.goto("/admin/users");
  const table = mobile.locator("table[data-stacked]").first();
  await expect(table).toBeVisible();
  // Header row is visually removed, but every cell carries its column name.
  const headers = await table.locator("thead th").allTextContents();
  const firstRowCells = table.locator("tbody tr").first().locator("td");
  const labels = await firstRowCells.evaluateAll((els) => els.map((el) => el.getAttribute("data-label")));
  expect(labels.length).toBeGreaterThanOrEqual(headers.length - 1);
  for (const h of headers.map((t) => t.trim()).filter(Boolean)) expect(labels).toContain(h);
  // The cards fit: no cell extends past the screen, and the table is not a sideways scroller any more.
  expect(await table.evaluate((el) => getComputedStyle(el).display)).toBe("block");
  expect(await sideways(mobile)).toBe(0);
  const cardBox = (await table.locator("tbody tr").first().boundingBox())!;
  expect(cardBox.x + cardBox.width).toBeLessThanOrEqual(390);
  await mobile.context().close();

  const tablet = await phone(browser, 900, 900);
  await signIn(tablet, E2E_ADMIN);
  await tablet.goto("/admin/users");
  expect(await tablet.locator("table").first().evaluate((el) => getComputedStyle(el).display)).toBe("table");
  await expect(tablet.locator("table thead th").first()).toBeVisible(); // header row is visible again
  await tablet.context().close();
});

test("the calendar shows each event as a card on a phone (title, time, currency, impact, figures) and as a table on a tablet", async ({ browser }) => {
  const mobile = await phone(browser, 390);
  await mobile.goto("/calendar");
  const row = mobile.locator("table tbody tr").filter({ has: mobile.locator('a[href^="/calendar/event/"]') }).first();
  await expect(row).toBeVisible();
  expect(await row.evaluate((el) => getComputedStyle(el).display)).toBe("grid");
  // Every cell of the row sits inside the screen: nothing is hidden behind a sideways scroll.
  const cells = await row.locator("td:visible").evaluateAll((els) => els.map((el) => el.getBoundingClientRect().right));
  for (const right of cells) expect(right).toBeLessThanOrEqual(390);
  await expect(row.locator('a[href^="/calendar/event/"]')).toBeInViewport({ ratio: 0.9 });
  expect(await sideways(mobile)).toBe(0);
  await mobile.context().close();

  const tablet = await phone(browser, 900, 900);
  await tablet.goto("/calendar");
  await expect(tablet.getByRole("columnheader", { name: "Forecast" })).toBeVisible();
  expect(await tablet.locator("table").first().evaluate((el) => getComputedStyle(el).display)).toBe("table");
  await tablet.context().close();
});

test("the Account / Seller / Admin side menu is a collapsible menu on phones and the original side nav elsewhere", async ({ browser }) => {
  const mobile = await phone(browser, 390);
  await signIn(mobile, E2E_ADMIN);
  await mobile.goto("/admin/users");
  const button = mobile.getByRole("button", { name: /Admin\s*Users/ });
  await expect(button).toHaveAttribute("aria-expanded", "false");
  const menu = mobile.getByRole("navigation", { name: "Admin menu" });
  await expect(menu).toBeHidden();
  await button.click();
  await expect(button).toHaveAttribute("aria-expanded", "true");
  await expect(menu.getByRole("link", { name: "Users", exact: true })).toHaveAttribute("aria-current", "page");
  const items = await menu.getByRole("link").count();
  expect(items).toBeGreaterThan(15); // every admin area is listed, none clipped away
  await menu.getByRole("link", { name: "Products", exact: true }).click();
  await expect(mobile).toHaveURL(/\/admin\/products$/);
  await expect(mobile.getByRole("button", { name: /Admin\s*Products/ })).toHaveAttribute("aria-expanded", "false"); // closed itself, names the new section
  await mobile.context().close();

  const desktop = await phone(browser, 1280, 900);
  await signIn(desktop, E2E_ADMIN);
  await desktop.goto("/admin/users");
  await expect(desktop.getByRole("navigation", { name: "Admin menu" })).toBeHidden();
  await expect(desktop.getByRole("link", { name: "Access Sessions", exact: true }).first()).toBeVisible(); // the original side nav
  await desktop.context().close();
});

test("controls are finger-sized on a phone and text fields are 16px (no zoom-on-focus)", async ({ browser }) => {
  const page = await phone(browser, 390);
  await page.goto("/auth/sign-in");
  for (const field of [page.getByLabel("Email"), page.getByLabel("Password", { exact: true })]) {
    expect(await field.evaluate((el) => parseFloat(getComputedStyle(el).fontSize))).toBeGreaterThanOrEqual(16);
    expect((await field.boundingBox())!.height).toBeGreaterThanOrEqual(40);
  }
  expect((await page.getByRole("button", { name: "Sign in" }).boundingBox())!.height).toBeGreaterThanOrEqual(40);
  // Header: logo target and Menu button.
  expect((await page.locator("header").getByRole("link", { name: /Bot\s*Hub/ }).first().boundingBox())!.height).toBeGreaterThanOrEqual(44);
  await page.context().close();
});

test("the homepage hero buttons stack and fit on the narrowest phone, and keep one row on a desktop", async ({ browser }) => {
  const small = await phone(browser, 320);
  await small.goto("/");
  const a = (await small.getByRole("link", { name: "Browse the marketplace" }).boundingBox())!;
  const b = (await small.getByRole("link", { name: "News Calendar", exact: true }).last().boundingBox())!;
  expect(a.x + a.width).toBeLessThanOrEqual(320);
  expect(b.x + b.width).toBeLessThanOrEqual(320);
  await small.context().close();

  const desktop = await phone(browser, 1280, 900);
  await desktop.goto("/");
  const d1 = (await desktop.getByRole("link", { name: "Browse the marketplace" }).boundingBox())!;
  const d2 = (await desktop.locator("main").getByRole("link", { name: "News Calendar", exact: true }).first().boundingBox())!;
  expect(Math.abs(d1.y - d2.y)).toBeLessThan(4); // side by side
  await desktop.context().close();
});
