import { test, expect } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { signIn, E2E_SELLER } from "./helpers";

// Market price (crossed out) + offer price (what buyers pay) -> a derived "NN% OFF" badge on the cover. The percentage is
// never stored; the server validates every pair. Seeds its own products and removes them afterwards.

const db = new PrismaClient();
const stamp = Date.now();
const names = {
  deal: `Disc Deal ${stamp}`, // 100.00 -> 65.00 = 35%
  plain: `Disc Plain ${stamp}`, // no market price
  tiny: `Disc Tiny ${stamp}`, // 100.00 -> 99.99: rounds to 0%, so no badge
  bad: `Disc Bad ${stamp}`, // market below offer (seeded directly): never shown as a discount
  free: `Disc Free ${stamp}`, // free product with a stale market price
};
const ids: string[] = [];

// A valid 1x1 PNG, stored as the cover so the badge sits on a real photo.
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", "base64");

test.beforeAll(async () => {
  const seller = await db.user.findFirstOrThrow({ where: { email: E2E_SELLER } });
  const base = { sellerId: seller.id, type: "EA" as const, platform: "MT5" as const, currency: "USD", status: "PUBLISHED" as const, publishedAt: new Date(), shortSummary: "A listing used by the discount end-to-end tests.", description: "Seeded for Playwright — safe to leave in the database." };
  const make = async (name: string, data: { pricingType: "ONE_TIME" | "FREE"; priceCents: number; marketPriceCents: number | null }) => {
    const p = await db.product.create({ data: { ...base, ...data, name, slug: `e2e-disc-${name.split(" ")[1].toLowerCase()}-${stamp}` } });
    ids.push(p.id);
    return p;
  };
  const deal = await make(names.deal, { pricingType: "ONE_TIME", priceCents: 6500, marketPriceCents: 10000 });
  const key = `products/${deal.id}/image/e2e-cover.png`;
  await db.storedObject.upsert({ where: { key }, create: { key, contentType: "image/png", sizeBytes: PNG.length, data: PNG }, update: {} });
  await db.productImage.create({ data: { productId: deal.id, storageKey: key, position: 0, altText: "cover" } });
  await make(names.plain, { pricingType: "ONE_TIME", priceCents: 4900, marketPriceCents: null });
  await make(names.tiny, { pricingType: "ONE_TIME", priceCents: 9999, marketPriceCents: 10000 });
  await make(names.bad, { pricingType: "ONE_TIME", priceCents: 6500, marketPriceCents: 5000 });
  await make(names.free, { pricingType: "FREE", priceCents: 0, marketPriceCents: 9000 });
});

test.afterAll(async () => {
  await db.productImage.deleteMany({ where: { productId: { in: ids } } });
  await db.storedObject.deleteMany({ where: { key: { startsWith: "products/" }, AND: { key: { endsWith: "e2e-cover.png" } } } });
  await db.product.deleteMany({ where: { id: { in: ids } } });
  await db.$disconnect();
});

const card = (page: import("@playwright/test").Page, name: string) => page.locator("a", { has: page.getByRole("heading", { name }) }).first();

test("a discounted product shows a red NN% OFF badge in the cover's top-left corner, with the market price crossed out", async ({ page }) => {
  await page.goto(`/marketplace?q=${encodeURIComponent(`Disc`)}`);
  const deal = card(page, names.deal);
  await expect(deal).toBeVisible();

  const badge = deal.getByTestId("discount-badge");
  await expect(badge).toHaveAttribute("aria-label", "35% off");
  await expect(badge).toContainText("35");
  await expect(badge).toContainText("OFF");
  expect(await badge.evaluate((el) => getComputedStyle(el).color)).toBe("rgb(229, 18, 31)"); // red

  // Top-left of the cover photo, fully inside it.
  const cover = (await deal.locator("div.aspect-\\[16\\/10\\]").boundingBox())!;
  const mark = (await badge.boundingBox())!;
  expect(mark.x - cover.x).toBeGreaterThanOrEqual(0);
  expect(mark.x - cover.x).toBeLessThanOrEqual(24);
  expect(mark.y - cover.y).toBeGreaterThanOrEqual(-6); // the tilt lifts the corner a few px
  expect(mark.y - cover.y).toBeLessThanOrEqual(24);
  expect(mark.x + mark.width).toBeLessThanOrEqual(cover.x + cover.width);
  expect(mark.y + mark.height).toBeLessThanOrEqual(cover.y + cover.height);

  // The offer price is prominent; the market price is crossed out next to it.
  await expect(deal).toContainText("$65.00");
  const market = deal.getByTestId("market-price");
  await expect(market).toContainText("$100.00");
  expect(await market.evaluate((el) => getComputedStyle(el).textDecorationLine)).toBe("line-through");

  // Clicking the badge area still opens the product (the badge never intercepts the click).
  await deal.click({ position: { x: 12, y: 12 } });
  await expect(page).toHaveURL(new RegExp(`/marketplace/e2e-disc-deal-${stamp}$`));
});

test("products without a valid discount show their normal price and no badge", async ({ page }) => {
  await page.goto(`/marketplace?q=${encodeURIComponent("Disc")}`);
  for (const name of [names.plain, names.tiny, names.bad, names.free]) {
    const c = card(page, name);
    await expect(c, name).toBeVisible();
    await expect(c.getByTestId("discount-badge"), name).toHaveCount(0);
    await expect(c.getByTestId("market-price"), name).toHaveCount(0);
  }
  await expect(card(page, names.plain)).toContainText("$49.00");
  await expect(card(page, names.tiny)).toContainText("$99.99"); // 0.01% rounds to 0 -> not a discount
  await expect(card(page, names.bad)).toContainText("$65.00"); // market below offer -> ignored
  await expect(card(page, names.free)).toContainText("Free");
});

test("the product page shows the badge on the cover, the crossed-out market price, the offer price and a Buy button at the offer price", async ({ page }) => {
  await page.goto(`/marketplace/e2e-disc-deal-${stamp}`);
  await expect(page.getByTestId("discount-badge")).toHaveAttribute("aria-label", "35% off");
  const price = page.getByTestId("detail-price");
  await expect(price).toContainText("$65.00");
  await expect(price).toContainText("$100.00");
  await expect(price).toContainText("35% OFF");
  expect(await price.locator("span.line-through").evaluate((el) => getComputedStyle(el).textDecorationLine)).toBe("line-through");
  await expect(page.getByRole("button", { name: "Buy — $65.00" })).toBeVisible();

  await page.goto(`/marketplace/e2e-disc-plain-${stamp}`);
  await expect(page.getByTestId("discount-badge")).toHaveCount(0);
  await expect(page.getByTestId("detail-price")).toContainText("$49.00");
  await expect(page.getByTestId("detail-price")).not.toContainText("OFF");
});

test("on a phone the badge stays inside the cover and the card does not overflow", async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 375, height: 700 } });
  const page = await context.newPage();
  await page.goto(`/marketplace?q=${encodeURIComponent("Disc")}`);
  const deal = card(page, names.deal);
  await expect(deal.getByTestId("discount-badge")).toBeVisible();
  const cover = (await deal.locator("div.aspect-\\[16\\/10\\]").boundingBox())!;
  const mark = (await deal.getByTestId("discount-badge").boundingBox())!;
  expect(mark.x).toBeGreaterThanOrEqual(cover.x);
  expect(mark.x + mark.width).toBeLessThanOrEqual(cover.x + cover.width);
  expect(mark.width).toBeLessThanOrEqual(cover.width * 0.5);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);

  await page.goto(`/marketplace/e2e-disc-deal-${stamp}`);
  const big = (await page.getByTestId("discount-badge").boundingBox())!;
  expect(big.x).toBeGreaterThanOrEqual(0);
  expect(big.x + big.width).toBeLessThanOrEqual(375);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
  await context.close();
});

test("the server refuses an invalid market/offer pair; a valid one saves and a free product drops the market price", async ({ page }) => {
  await signIn(page, E2E_SELLER);
  const seller = await db.user.findFirstOrThrow({ where: { email: E2E_SELLER } });
  const mine = await db.product.create({
    data: { sellerId: seller.id, name: `Disc Form ${stamp}`, slug: `e2e-disc-form-${stamp}`, type: "EA", platform: "MT5", pricingType: "ONE_TIME", priceCents: 6500, marketPriceCents: null, currency: "USD", status: "DRAFT", shortSummary: "A draft used by the discount form test.", description: "Seeded for Playwright — safe to leave in the database." },
  });
  ids.push(mine.id);

  const save = async () => {
    await page.getByRole("button", { name: "Save changes" }).click();
    await page.waitForLoadState("networkidle");
  };
  const open = () => page.goto(`/seller/products/${mine.id}`);
  await open();
  await expect(page.getByLabel("Market price (USD)")).toHaveValue("");
  await expect(page.getByLabel("Offer price (USD)")).toHaveValue("65.00");

  // The form shows the live percentage as you type — and a market price below the offer is flagged.
  await page.getByLabel("Market price (USD)").fill("100");
  await expect(page.getByTestId("discount-preview")).toContainText("35% OFF");
  await page.getByLabel("Market price (USD)").fill("50");
  await expect(page.getByRole("alert").filter({ hasText: "lower than the market price" })).toBeVisible();

  // Submitting that anyway (the browser doesn't block it): the SERVER refuses and nothing changes.
  await save();
  const afterBad = await db.product.findUniqueOrThrow({ where: { id: mine.id } });
  expect(afterBad.marketPriceCents).toBeNull();
  expect(afterBad.priceCents).toBe(6500);

  // A valid pair is saved as cents.
  await open();
  await page.getByLabel("Market price (USD)").fill("100");
  await save();
  await expect.poll(async () => (await db.product.findUniqueOrThrow({ where: { id: mine.id } })).marketPriceCents).toBe(10000);
  expect((await db.product.findUniqueOrThrow({ where: { id: mine.id } })).priceCents).toBe(6500);

  // Clearing the market price removes the discount.
  await open();
  await page.getByLabel("Market price (USD)").fill("");
  await save();
  await expect.poll(async () => (await db.product.findUniqueOrThrow({ where: { id: mine.id } })).marketPriceCents).toBeNull();

  // A free product never keeps a market price.
  await open();
  await page.getByLabel("Market price (USD)").fill("100");
  await page.getByLabel("Offer price (USD)").fill("0");
  await page.locator('select[name="pricingType"]').selectOption("FREE");
  await save();
  await expect.poll(async () => (await db.product.findUniqueOrThrow({ where: { id: mine.id } })).pricingType).toBe("FREE");
  const free = await db.product.findUniqueOrThrow({ where: { id: mine.id } });
  expect(free.priceCents).toBe(0);
  expect(free.marketPriceCents).toBeNull();
});

test("the wizard asks for a market and an offer price in dollars and explains an invalid pair", async ({ page }) => {
  await signIn(page, E2E_SELLER);
  await page.goto("/seller/products/new");
  const next = page.locator("main").getByRole("button", { name: "Next", exact: true });
  await next.click();
  await next.click();
  await page.getByLabel("Product name").fill(`Disc Wizard ${stamp}`);
  await page.getByLabel("Short summary").fill("A wizard product used by the discount test.");
  await next.click();
  await page.getByLabel("Description").fill("Created by a Playwright test exercising the discount fields.");
  await next.click();
  await next.click(); // screenshots
  await next.click(); // files
  await page.locator("main").getByRole("button", { name: "One-time purchase" }).click();

  await expect(page.getByLabel("Market price (USD)")).toHaveValue("");
  await expect(page.getByLabel("Offer price (USD)")).toHaveValue("0.00");
  await expect(page.locator("main")).not.toContainText(/cents/i);

  await page.getByLabel("Offer price (USD)").fill("65");
  await page.getByLabel("Market price (USD)").fill("60");
  await expect(page.getByRole("alert").filter({ hasText: "lower than the market price" })).toBeVisible();
  await next.click();
  await expect(page.getByText("must be lower than the market price").first()).toBeVisible();
  await expect(page.getByText("Compatibility notes")).toHaveCount(0); // did not advance

  await page.getByLabel("Market price (USD)").fill("100");
  await expect(page.getByTestId("discount-preview")).toContainText("35% OFF");
  await next.click();
  await expect(page.getByText("Compatibility notes")).toBeVisible();
  await next.click();
  await page.getByRole("button", { name: "Submit for review" }).click();
  await expect(page).toHaveURL(/\/seller\/products\/(?!new$)[a-z0-9]+$/, { timeout: 15_000 });
  const id = page.url().split("/").pop()!;
  ids.push(id);
  const saved = await db.product.findUniqueOrThrow({ where: { id } });
  expect(saved.priceCents).toBe(6500);
  expect(saved.marketPriceCents).toBe(10000);
});
