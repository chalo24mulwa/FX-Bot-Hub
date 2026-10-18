import { test, expect, type Page } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { E2E_SELLER } from "./helpers";

// Product cards: hovering (or focusing) collapses the cover and reveals the description inside the same card, with no layout jump;
// leaving restores it. On touch screens, where hover does not exist, a details button does the same by tap.

const db = new PrismaClient();
const stamp = Date.now();
const TYPES = ["EA", "INDICATOR", "SIGNAL", "TOOL", "OTHER"] as const;
const ids: string[] = [];
const nameOf = (type: string) => `Pv ${type} ${stamp}`;
const summaryOf = (type: string) => `Preview summary for the ${type} product ${stamp}.`;

test.beforeAll(async () => {
  const seller = await db.user.findFirstOrThrow({ where: { email: E2E_SELLER } });
  for (const [i, type] of TYPES.entries()) {
    const p = await db.product.create({
      data: {
        sellerId: seller.id,
        name: nameOf(type),
        slug: `e2e-pv-${type.toLowerCase()}-${stamp}`,
        type,
        platform: i % 2 === 0 ? "MT5" : "MT4",
        pricingType: "ONE_TIME",
        priceCents: 6500,
        marketPriceCents: i === 0 ? 10000 : null, // the first one also carries a discount badge
        currency: "USD",
        status: "PUBLISHED",
        publishedAt: new Date(),
        featured: i === 1,
        shortSummary: summaryOf(type),
        features: ["Works on every timeframe", "Built-in risk controls", "Third feature that is not shown"],
        description: "Seeded for Playwright — safe to leave in the database.",
      },
    });
    ids.push(p.id);
  }
});

test.afterAll(async () => {
  await db.product.deleteMany({ where: { id: { in: ids } } });
  await db.$disconnect();
});

const card = (page: Page, name: string) => page.getByTestId("product-card").filter({ has: page.getByRole("heading", { name }) });
const open = (page: Page) => page.goto(`/marketplace?q=${encodeURIComponent(`Pv`)}`);
const opacityOf = (page: Page, name: string) => card(page, name).getByTestId("card-preview").evaluate((el) => getComputedStyle(el).opacity);
const imageLayerHeight = (page: Page, name: string) => card(page, name).locator("div.aspect-\\[16\\/10\\] > div").first().evaluate((el) => el.getBoundingClientRect().height);

test("hovering a card collapses the cover and reveals the description in the same card; leaving restores it — for every product type", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await open(page);
  await expect(card(page, nameOf("EA"))).toBeVisible();

  for (const type of TYPES) {
    const name = nameOf(type);
    const c = card(page, name);
    await c.scrollIntoViewIfNeeded();
    const before = (await c.boundingBox())!;
    const coverBefore = await imageLayerHeight(page, name);
    expect(await opacityOf(page, name)).toBe("0");

    await c.hover();
    await expect.poll(() => opacityOf(page, name), { timeout: 3000 }).toBe("1");
    await expect.poll(() => imageLayerHeight(page, name), { timeout: 3000 }).toBeLessThan(coverBefore * 0.5);
    await expect(c.getByTestId("card-preview")).toContainText(summaryOf(type));
    await expect(c.getByTestId("card-preview")).toContainText("Works on every timeframe");
    await expect(c.getByTestId("card-preview")).not.toContainText("Third feature"); // only the first two are previewed

    // Same card, same size: no layout jump for the grid.
    const during = (await c.boundingBox())!;
    expect(Math.abs(during.height - before.height)).toBeLessThanOrEqual(1);
    expect(Math.abs(during.width - before.width)).toBeLessThanOrEqual(1);
    expect(Math.abs(during.y - before.y)).toBeLessThanOrEqual(1);

    // Everything else on the card is still there: title, seller, price, link.
    await expect(c.getByRole("heading", { name })).toBeVisible();
    await expect(c.getByText("by E2E Seller")).toBeVisible();
    await expect(c.getByText("$65.00")).toBeVisible();
    await expect(c.getByTestId("star-rating")).toBeVisible();
    await expect(c.locator(`a[href="/marketplace/e2e-pv-${type.toLowerCase()}-${stamp}"]`)).toBeVisible();

    await page.mouse.move(2, 2);
    await expect.poll(() => opacityOf(page, name), { timeout: 3000 }).toBe("0");
    await expect.poll(() => imageLayerHeight(page, name), { timeout: 3000 }).toBeGreaterThan(coverBefore * 0.95);
    const after = (await c.boundingBox())!;
    expect(Math.abs(after.height - before.height)).toBeLessThanOrEqual(1);
  }
});

test("the discount badge stays on the cover while previewing, and keyboard focus opens the preview too", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await open(page);
  const c = card(page, nameOf("EA"));
  const badge = c.getByTestId("discount-badge");
  await expect(badge).toHaveAttribute("aria-label", "35% off");
  await c.hover();
  await expect.poll(() => opacityOf(page, nameOf("EA"))).toBe("1");
  await expect(badge).toBeVisible();
  const cover = (await c.locator("div.aspect-\\[16\\/10\\]").boundingBox())!;
  const mark = (await badge.boundingBox())!;
  expect(mark.x).toBeGreaterThanOrEqual(cover.x - 1);
  expect(mark.y).toBeGreaterThanOrEqual(cover.y - 8);
  expect(mark.y + mark.height).toBeLessThanOrEqual(cover.y + cover.height * 0.5); // it shrank into the collapsed image strip

  await page.mouse.move(2, 2);
  await expect.poll(() => opacityOf(page, nameOf("OTHER"))).toBe("0");
  await page.keyboard.press("Shift"); // keyboard modality, so the focus below counts as keyboard focus
  await card(page, nameOf("OTHER")).locator("a").first().focus();
  await expect.poll(() => opacityOf(page, nameOf("OTHER")), { timeout: 3000 }).toBe("1");
});

test("clicking a card still opens the product", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await open(page);
  await card(page, nameOf("INDICATOR")).getByRole("heading").click();
  await expect(page).toHaveURL(new RegExp(`/marketplace/e2e-pv-indicator-${stamp}$`));
});

test("on a touch screen the details button reveals and hides the description; tapping the card still opens the product", async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 800 }, hasTouch: true, isMobile: true });
  const page = await context.newPage();
  await open(page);
  const name = nameOf("SIGNAL");
  const c = card(page, name);
  await c.scrollIntoViewIfNeeded();
  const toggle = c.getByRole("button", { name: "Show product details" });
  await expect(toggle).toBeVisible();
  const box = (await toggle.boundingBox())!;
  expect(box.width).toBeGreaterThanOrEqual(44);
  expect(box.height).toBeGreaterThanOrEqual(44);
  expect(await opacityOf(page, name)).toBe("0");

  const before = (await c.boundingBox())!;
  await toggle.tap();
  await expect(c.getByRole("button", { name: "Hide product details" })).toHaveAttribute("aria-expanded", "true");
  await expect.poll(() => opacityOf(page, name), { timeout: 3000 }).toBe("1");
  await expect(c.getByTestId("card-preview")).toContainText(summaryOf("SIGNAL"));
  const during = (await c.boundingBox())!;
  expect(Math.abs(during.height - before.height)).toBeLessThanOrEqual(1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
  await expect(page).toHaveURL(/\/marketplace\?q=Pv/); // the tap did not navigate

  await c.getByRole("button", { name: "Hide product details" }).tap();
  await expect.poll(() => opacityOf(page, name), { timeout: 3000 }).toBe("0");

  await c.getByRole("heading", { name }).tap();
  await expect(page).toHaveURL(new RegExp(`/marketplace/e2e-pv-signal-${stamp}$`));
  await context.close();
});

test("on desktop the touch button is not shown", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await open(page);
  await expect(card(page, nameOf("EA")).getByRole("button", { name: "Show product details" })).toBeHidden();
});
