import { test, expect } from "@playwright/test";
import { signIn, E2E_ADMIN } from "./helpers";

test("a buyer can request a refund, an admin can approve it, and entitlement is revoked", async ({ page }) => {
  const email = `e2e-refund-buyer-${Date.now()}@fxbotmarket.local`;

  await page.goto("/auth/sign-up");
  await page.getByLabel("Name").fill("E2E Refund Buyer");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill("password123");
  await page.getByRole("button", { name: "Sign up" }).click();
  await page.waitForURL(/\/auth\/sign-in$/);
  await signIn(page, email);

  await page.goto("/marketplace/e2e-free-product");
  await page.getByRole("button", { name: /Get for free/ }).click();
  await expect(page).toHaveURL(/\/cart$/);
  await page.getByRole("button", { name: "Checkout" }).click();
  await expect(page).toHaveURL(/\/dashboard\/orders\//, { timeout: 15_000 });
  await expect(page.getByText("PAID")).toBeVisible();

  await page.getByRole("button", { name: "Request refund" }).click();
  await page.getByRole("textbox").fill("E2E refund test");
  await page.getByRole("button", { name: "Submit request" }).click();
  await expect(page.getByText("Refund requested")).toBeVisible({ timeout: 10_000 });

  const orderUrl = page.url();

  await signIn(page, E2E_ADMIN);
  await page.goto("/admin/refunds");
  const row = page.getByRole("row", { name: new RegExp(email) });
  await expect(row).toBeVisible();
  page.once("dialog", (dialog) => dialog.accept());
  await row.getByRole("button", { name: "Approve" }).click();
  await expect(row.getByText("PROCESSED")).toBeVisible({ timeout: 10_000 });

  await signIn(page, email);
  await page.goto(orderUrl);
  await expect(page.getByText("REFUNDED", { exact: true })).toBeVisible();

  await page.goto("/marketplace/e2e-free-product");
  await expect(page.getByText("You own this product")).not.toBeVisible();
});
