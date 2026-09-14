import { test, expect } from "@playwright/test";
import { signIn, E2E_BUYER } from "./helpers";

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

test("a signed-in user can leave a review and see it listed with a rating", async ({ page }) => {
  await signIn(page, E2E_BUYER);
  await page.goto("/marketplace/e2e-free-product");
  await page.getByRole("button", { name: "Reviews" }).click();

  const reviewForm = page.getByText("Write a review");
  if (await reviewForm.isVisible().catch(() => false)) {
    await page.getByRole("button", { name: "5 stars" }).click();
    await page.getByPlaceholder("Share your experience…").fill("Great free tool, works as described.");
    await page.getByRole("button", { name: "Submit review" }).click();
  }

  await expect(page.getByText("Great free tool, works as described.")).toBeVisible({ timeout: 10_000 });
});
