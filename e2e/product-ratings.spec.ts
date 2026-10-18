import { test, expect, type Page } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { signIn, E2E_SELLER } from "./helpers";

// Five-star ratings: honest display (empty stars + "Not yet rated" until someone rates), only verified purchasers can rate,
// one review per customer per product (re-submitting edits it), exact averages and counts. Seeds its own users and products.

const db = new PrismaClient();
const stamp = Date.now();
const PASSWORD = "password123";
const emails = { buyerA: `rate-a-${stamp}@e2e.local`, buyerB: `rate-b-${stamp}@e2e.local`, stranger: `rate-s-${stamp}@e2e.local` };
const names = { fresh: `Rate Fresh ${stamp}`, rated: `Rate Rated ${stamp}` };
let freshId = "";
let ratedId = "";
const userIds: string[] = [];

async function makeUser(email: string, name: string) {
  const user = await db.user.create({ data: { email, name, password: await bcrypt.hash(PASSWORD, 10), role: "USER", profile: { create: { displayName: name } } } });
  userIds.push(user.id);
  return user;
}

async function buy(userId: string, productId: string) {
  const order = await db.order.create({ data: { userId, status: "PAID", totalCents: 0, currency: "USD", items: { create: { productId, unitPriceCents: 0, quantity: 1 } } } });
  return order;
}

test.beforeAll(async () => {
  const seller = await db.user.findFirstOrThrow({ where: { email: E2E_SELLER } });
  const base = { sellerId: seller.id, type: "EA" as const, platform: "MT5" as const, pricingType: "FREE" as const, priceCents: 0, currency: "USD", status: "PUBLISHED" as const, publishedAt: new Date(), shortSummary: "A listing used by the ratings end-to-end tests.", description: "Seeded for Playwright — safe to leave in the database." };
  freshId = (await db.product.create({ data: { ...base, name: names.fresh, slug: `e2e-rate-fresh-${stamp}` } })).id;
  ratedId = (await db.product.create({ data: { ...base, name: names.rated, slug: `e2e-rate-rated-${stamp}` } })).id;
  const a = await makeUser(emails.buyerA, "Rita Buyer");
  const b = await makeUser(emails.buyerB, "Ben Buyer");
  await makeUser(emails.stranger, "Sam Stranger");
  await buy(a.id, ratedId);
  await buy(b.id, ratedId);
});

test.afterAll(async () => {
  await db.review.deleteMany({ where: { productId: { in: [freshId, ratedId] } } });
  await db.orderItem.deleteMany({ where: { productId: { in: [freshId, ratedId] } } });
  await db.order.deleteMany({ where: { userId: { in: userIds } } });
  await db.productRatingSummary.deleteMany({ where: { productId: { in: [freshId, ratedId] } } });
  await db.product.deleteMany({ where: { id: { in: [freshId, ratedId] } } });
  await db.user.deleteMany({ where: { id: { in: userIds } } });
  await db.$disconnect();
});

const card = (page: Page, name: string) => page.locator("a", { has: page.getByRole("heading", { name }) }).first();

async function rate(page: Page, stars: number, text?: string) {
  await page.getByRole("button", { name: "Reviews" }).click();
  await page.getByRole("button", { name: `${stars} star${stars === 1 ? "" : "s"}`, exact: true }).click();
  if (text) await page.getByPlaceholder("Share your experience…").fill(text);
  await page.getByRole("button", { name: /Submit review|Update review/ }).click();
}

test("an unrated product shows five empty stars and Not yet rated — never a made-up rating", async ({ page }) => {
  await page.goto(`/marketplace?q=${encodeURIComponent("Rate Fresh")}`);
  const stars = card(page, names.fresh).getByTestId("star-rating");
  await expect(stars).toHaveAttribute("data-rated", "false");
  await expect(stars).toContainText("Not yet rated");
  await expect(stars.getByTestId("star-fill")).toHaveCount(0);
  expect(await stars.locator("svg").count()).toBe(5);

  await page.goto(`/marketplace/e2e-rate-fresh-${stamp}`);
  await expect(page.getByTestId("star-rating").first()).toContainText("Not yet rated");
  await expect(page.getByTestId("star-rating").first()).toHaveAttribute("data-rated", "false");
  await page.getByRole("button", { name: "Reviews" }).click();
  await expect(page.getByTestId("rating-summary")).toContainText("Not yet rated");
  await expect(page.getByText("No reviews yet.")).toBeVisible();
  // Signed out: invited to sign in, no form.
  await expect(page.getByText("to rate this product once you've bought it")).toBeVisible();
  await expect(page.getByText("Write a review")).toHaveCount(0);
});

test("only a verified purchaser can rate: strangers and the seller are refused, in the page and in the API", async ({ page, browser }) => {
  // A signed-in customer who never bought it.
  await signIn(page, emails.stranger);
  await page.goto(`/marketplace/e2e-rate-rated-${stamp}`);
  await page.getByRole("button", { name: "Reviews" }).click();
  await expect(page.getByTestId("review-not-allowed")).toContainText("Only customers who bought or got this product can rate it.");
  await expect(page.getByText("Write a review")).toHaveCount(0);
  const refused = await page.request.post(`/api/products/${ratedId}/reviews`, { data: { rating: 5 }, headers: { origin: "http://localhost:3000" } });
  expect(refused.status()).toBe(403);
  expect(await db.review.count({ where: { productId: ratedId } })).toBe(0);

  // The product's own seller.
  const seller = await (await browser.newContext()).newPage();
  await signIn(seller, E2E_SELLER);
  await seller.goto(`/marketplace/e2e-rate-rated-${stamp}`);
  await seller.getByRole("button", { name: "Reviews" }).click();
  await expect(seller.getByTestId("review-not-allowed")).toContainText("can't rate your own product");
  const ownRefused = await seller.request.post(`/api/products/${ratedId}/reviews`, { data: { rating: 5 }, headers: { origin: "http://localhost:3000" } });
  expect(ownRefused.status()).toBe(403);
  await seller.context().close();
});

test("purchasers rate 1–5, averages and counts are exact, one review each (re-submitting edits it), and it survives product edits", async ({ browser }) => {
  const ctxA = await browser.newContext();
  const a = await ctxA.newPage();
  await signIn(a, emails.buyerA);
  await a.goto(`/marketplace/e2e-rate-rated-${stamp}`);

  // A rating is a deliberate choice: submitting without choosing stars is refused.
  await a.getByRole("button", { name: "Reviews" }).click();
  await a.getByRole("button", { name: "Submit review" }).click();
  await expect(a.getByRole("alert").filter({ hasText: "Choose a rating" })).toBeVisible();
  // Out-of-range values are refused by the server too.
  for (const bad of [0, 6, 3.5]) {
    const res = await a.request.post(`/api/products/${ratedId}/reviews`, { data: { rating: bad }, headers: { origin: "http://localhost:3000" } });
    expect(res.status(), `rating ${bad}`).toBe(422);
  }
  expect(await db.review.count({ where: { productId: ratedId } })).toBe(0);

  // First purchaser: 4 stars with a written review.
  await rate(a, 4, "Solid EA, behaves as described.");
  await expect(a.getByRole("paragraph").filter({ hasText: "Solid EA, behaves as described." })).toBeVisible({ timeout: 10_000 });
  await expect(a.getByTestId("rating-summary")).toContainText("4.0");
  await expect(a.getByTestId("rating-summary")).toContainText("1 review");
  await expect(a.getByText("Verified purchase", { exact: true })).toBeVisible();

  // Second purchaser: 5 stars, no text (the review text is optional).
  const ctxB = await browser.newContext();
  const b = await ctxB.newPage();
  await signIn(b, emails.buyerB);
  await b.goto(`/marketplace/e2e-rate-rated-${stamp}`);
  await rate(b, 5);
  await expect(b.getByTestId("rating-summary")).toContainText("4.5", { timeout: 10_000 });
  await expect(b.getByTestId("rating-summary")).toContainText("2 reviews");

  // The card and the header show the same exact numbers; the fill is 4.5/5 = 90% of the stars.
  await a.goto(`/marketplace?q=${encodeURIComponent("Rate Rated")}`);
  const stars = card(a, names.rated).getByTestId("star-rating");
  await expect(stars).toHaveAttribute("data-rated", "true");
  await expect(stars).toContainText("4.5");
  await expect(stars).toContainText("(2)");
  expect(await stars.getByTestId("star-fill").evaluate((el) => (el as HTMLElement).style.width)).toBe("90%");

  // Re-submitting is an edit, not a duplicate: still one review per customer, values and average updated.
  await a.goto(`/marketplace/e2e-rate-rated-${stamp}`);
  await a.getByRole("button", { name: "Reviews" }).click();
  await expect(a.getByText("Edit your review")).toBeVisible();
  await a.getByRole("button", { name: "2 stars", exact: true }).click();
  await a.getByPlaceholder("Share your experience…").fill("Changed my mind after a month.");
  await a.getByRole("button", { name: "Update review" }).click();
  await expect(a.getByText("Review updated.")).toBeVisible({ timeout: 10_000 });
  expect(await db.review.count({ where: { productId: ratedId } })).toBe(2);
  const summary = await db.productRatingSummary.findUniqueOrThrow({ where: { productId: ratedId } });
  expect(summary.count).toBe(2);
  expect(summary.average).toBeCloseTo(3.5, 5);
  expect([summary.star1, summary.star2, summary.star3, summary.star4, summary.star5]).toEqual([0, 1, 0, 0, 1]);

  // The rating stays with the product through edits (name, price, description changes).
  await db.product.update({ where: { id: ratedId }, data: { name: `${names.rated} v2`, description: "Edited description for the ratings test.", priceCents: 0 } });
  await a.goto(`/marketplace/e2e-rate-rated-${stamp}`);
  await expect(a.getByTestId("star-rating").first()).toContainText("3.5");
  await expect(a.getByTestId("star-rating").first()).toContainText("(2)");
  await db.product.update({ where: { id: ratedId }, data: { name: names.rated } });
  await ctxA.close();
  await ctxB.close();
});
