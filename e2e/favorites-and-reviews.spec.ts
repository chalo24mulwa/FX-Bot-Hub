import { test, expect } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { signIn, E2E_BUYER } from "./helpers";

const db = new PrismaClient();

test("a signed-in user can favorite a product and see it in their dashboard", async ({ page }) => {
  await signIn(page, E2E_BUYER);
  await page.goto("/marketplace/e2e-free-product");

  const favoriteButton = page.getByRole("button", { name: /favorites/ });
  const wasFavorited = (await favoriteButton.getAttribute("aria-pressed")) === "true";
  if (!wasFavorited) {
    await favoriteButton.click();
    await expect(page.getByRole("button", { name: "Remove from favorites" })).toBeVisible();
  }

  await page.goto("/dashboard/favorites");
  await expect(page.getByText("E2E Free Product")).toBeVisible();
});

// Only verified purchasers can rate (see src/features/reviews/review-service.ts), so this uses its own customer who has a paid
// (here: free, $0) order for the product — the same thing "Get for free" creates — rather than touching the shared e2e buyer's orders.
test("a verified purchaser can leave a review and see it listed with a rating", async ({ page }) => {
  const email = `reviewer-${Date.now()}@e2e.local`;
  const product = await db.product.findUniqueOrThrow({ where: { slug: "e2e-free-product" } });
  const user = await db.user.create({
    data: { email, name: "Rev Iewer", password: await bcrypt.hash("password123", 10), role: "USER", profile: { create: { displayName: "Rev Iewer" } } },
  });
  await db.order.create({ data: { userId: user.id, status: "PAID", totalCents: 0, currency: "USD", items: { create: { productId: product.id, unitPriceCents: 0, quantity: 1 } } } });

  try {
    await signIn(page, email);
    await page.goto("/marketplace/e2e-free-product");
    await page.getByRole("button", { name: "Reviews" }).click();

    await expect(page.getByText("Write a review")).toBeVisible();
    await page.getByRole("button", { name: "5 stars" }).click();
    await page.getByPlaceholder("Share your experience…").fill("Great free tool, works as described.");
    await page.getByRole("button", { name: "Submit review" }).click();

    await expect(page.getByRole("paragraph").filter({ hasText: "Great free tool, works as described." })).toBeVisible({ timeout: 10_000 });
  } finally {
    await db.review.deleteMany({ where: { userId: user.id } });
    await db.order.deleteMany({ where: { userId: user.id } });
    await db.user.delete({ where: { id: user.id } });
    // The rating summary is derived data: rebuild it from whatever reviews remain so other specs see consistent numbers.
    const remaining = await db.review.findMany({ where: { productId: product.id, hidden: false }, select: { rating: true } });
    const stars = [1, 2, 3, 4, 5].map((n) => remaining.filter((r) => r.rating === n).length);
    const average = remaining.length ? remaining.reduce((a, r) => a + r.rating, 0) / remaining.length : 0;
    await db.productRatingSummary.upsert({
      where: { productId: product.id },
      update: { average, count: remaining.length, star1: stars[0], star2: stars[1], star3: stars[2], star4: stars[3], star5: stars[4] },
      create: { productId: product.id, average, count: remaining.length, star1: stars[0], star2: stars[1], star3: stars[2], star4: stars[3], star5: stars[4] },
    });
  }
});
