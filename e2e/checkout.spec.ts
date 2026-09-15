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

test("checking out twice with the same idempotency key returns the same order, not a duplicate", async ({ page }) => {
  const email = `e2e-idempotency-buyer-${Date.now()}@fxbotmarket.local`;

  await page.goto("/auth/sign-up");
  await page.getByPlaceholder("Name").fill("E2E Idempotency Buyer");
  await page.getByPlaceholder("Email").fill(email);
  await page.getByPlaceholder("Password").fill("password123");
  await page.getByRole("button", { name: "Sign up" }).click();
  await page.waitForURL(/\/auth\/sign-in$/);
  await signIn(page, email);

  await page.goto("/marketplace/e2e-free-product");
  await page.getByRole("button", { name: /Get for free/ }).click();
  await expect(page).toHaveURL(/\/cart$/);

  // page.request is a raw HTTP client, not a browser fetch() call — it
  // won't auto-send Origin the way in-page JS does, and the checkout route
  // requires one (assertSameOrigin). Set it explicitly to match baseURL.
  const idempotencyKey = `e2e-idempotency-${Date.now()}`;
  const headers = { "Idempotency-Key": idempotencyKey, Origin: "http://localhost:3000" };
  const [first, second] = await Promise.all([
    page.request.post("/api/checkout", { headers }),
    page.request.post("/api/checkout", { headers }),
  ]);
  expect(first.ok()).toBe(true);
  expect(second.ok()).toBe(true);

  const firstBody = await first.json();
  const secondBody = await second.json();
  expect(firstBody.orderId).toBe(secondBody.orderId);

  await page.goto("/dashboard/orders");
  const orderRows = page.getByText("E2E Free Product");
  await expect(orderRows).toHaveCount(1);
});
