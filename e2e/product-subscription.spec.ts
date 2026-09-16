import { test, expect } from "@playwright/test";
import { signIn } from "./helpers";

test("a buyer can subscribe to a subscription-priced product, see it active, and cancel it", async ({ page }) => {
  const email = `e2e-subscriber-${Date.now()}@fxbotmarket.local`;

  await page.goto("/auth/sign-up");
  await page.getByLabel("Name").fill("E2E Subscriber");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill("password123");
  await page.getByRole("button", { name: "Sign up" }).click();
  await page.waitForURL(/\/auth\/sign-in$/);
  await signIn(page, email);

  await page.goto("/marketplace/e2e-subscription-product");
  await expect(page.getByRole("heading", { name: "E2E Subscription Product" })).toBeVisible();
  await page.getByRole("button", { name: /Subscribe —/ }).click();
  await expect(page).toHaveURL(/\/cart$/);

  await page.getByRole("button", { name: "Checkout" }).click();
  await expect(page).toHaveURL(/\/dashboard\/orders\//, { timeout: 15_000 });
  await expect(page.getByText("PAID")).toBeVisible();

  await page.goto("/marketplace/e2e-subscription-product");
  await expect(page.getByText("You're subscribed")).toBeVisible();

  await page.goto("/dashboard/product-subscriptions");
  const row = page.getByRole("listitem").filter({ hasText: "E2E Subscription Product" });
  await expect(row.getByText("ACTIVE")).toBeVisible();

  await row.getByRole("button", { name: "Cancel" }).click();
  await expect(row.getByRole("button", { name: "Resume" })).toBeVisible({ timeout: 10_000 });
  await expect(row.getByText(/ends/)).toBeVisible();
});
