import { test, expect } from "@playwright/test";
import { signIn, E2E_SELLER, E2E_ADMIN } from "./helpers";

test("an unauthenticated visitor is redirected away from protected areas", async ({ page }) => {
  for (const path of ["/dashboard", "/seller", "/admin"]) {
    await page.goto(path);
    await expect(page).toHaveURL(/\/auth\/sign-in/);
  }
});

test("a seller cannot reach the admin area", async ({ page }) => {
  await signIn(page, E2E_SELLER);
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/auth\/sign-in/);
});

test("a buyer cannot reach the seller area", async ({ page }) => {
  await signIn(page, "e2e-buyer@fxbotmarket.local");
  await page.goto("/seller");
  await expect(page).toHaveURL(/\/auth\/sign-in/);
});

test("an admin can reach both the admin and seller-gated logic checks", async ({ page }) => {
  await signIn(page, E2E_ADMIN);
  await page.goto("/admin");
  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
});
