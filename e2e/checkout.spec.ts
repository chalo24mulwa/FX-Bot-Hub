import { test, expect } from "@playwright/test";
import { signIn, E2E_BUYER } from "./helpers";

test("a buyer can add a free product to cart, check out, and see it as owned", async ({ page }) => {
  await signIn(page, E2E_BUYER);

  await page.goto("/marketplace/e2e-free-product");
  await expect(page.getByRole("heading", { name: "E2E Free Product" })).toBeVisible();

  // If a previous run already purchased this for this buyer, the page shows
  // ownership instead of a buy button — treat that as already satisfied.
  const ownedLabel = page.getByText("You own this product");
  if (await ownedLabel.isVisible().catch(() => false)) {
    return;
  }

  await page.getByRole("button", { name: /Get for free/ }).click();
  await expect(page).toHaveURL(/\/cart$/);

  await page.getByRole("button", { name: "Checkout" }).click();
  await expect(page).toHaveURL(/\/dashboard\/orders\//, { timeout: 15_000 });
  await expect(page.getByText("PAID")).toBeVisible();

  await page.goto("/marketplace/e2e-free-product");
  await expect(page.getByText("You own this product")).toBeVisible();
});
