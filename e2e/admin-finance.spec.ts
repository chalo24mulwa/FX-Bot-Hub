import { test, expect } from "@playwright/test";
import { signIn, E2E_ADMIN } from "./helpers";

test("an admin can view the finance dashboard with range filters", async ({ page }) => {
  await signIn(page, E2E_ADMIN);
  await page.goto("/admin/finance");
  await expect(page.getByRole("heading", { name: "Finance" })).toBeVisible();
  await expect(page.getByText("Gross sales")).toBeVisible();
  await expect(page.getByText("Net marketplace revenue")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Outstanding seller balances" })).toBeVisible();

  await page.getByRole("link", { name: "This month" }).click();
  await expect(page).toHaveURL(/range=month/);
  await expect(page.getByRole("heading", { name: "Finance" })).toBeVisible();
});

test("an admin can view payouts, licenses, and security event logs", async ({ page }) => {
  await signIn(page, E2E_ADMIN);

  await page.goto("/admin/payouts");
  await expect(page.getByRole("heading", { name: "Payouts" })).toBeVisible();

  await page.goto("/admin/licenses");
  await expect(page.getByRole("heading", { name: "Licenses" })).toBeVisible();

  await page.goto("/admin/security");
  await expect(page.getByRole("heading", { name: "Security events" })).toBeVisible();
});

test("a seller can view their balance and ledger on the payout page", async ({ page }) => {
  await signIn(page, "e2e-seller@fxbotmarket.local");
  await page.goto("/seller/payout");
  await expect(page.getByRole("heading", { name: "Payout & balance" })).toBeVisible();
  await expect(page.getByText("Available balance")).toBeVisible();
});
