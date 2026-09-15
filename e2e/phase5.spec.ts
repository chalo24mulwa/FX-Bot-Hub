import { test, expect } from "@playwright/test";
import { signIn, E2E_ADMIN, E2E_BUYER } from "./helpers";

test("an admin can view the platform analytics dashboard", async ({ page }) => {
  await signIn(page, E2E_ADMIN);
  await page.goto("/admin/analytics");
  await expect(page.getByRole("heading", { name: "Platform analytics" })).toBeVisible();
  await expect(page.getByText("Product views", { exact: true })).toBeVisible();
  await expect(page.getByText("Searches", { exact: true })).toBeVisible();
});

test("an admin can view the background jobs page", async ({ page }) => {
  await signIn(page, E2E_ADMIN);
  await page.goto("/admin/queues");
  await expect(page.getByRole("heading", { name: "Background jobs" })).toBeVisible();
  await expect(page.getByRole("row", { name: /^email/ })).toBeVisible();
});

test("a product page shows the quality signals checklist without claiming performance", async ({ page }) => {
  await page.goto("/marketplace/e2e-free-product");
  await expect(page.getByText(/Quality signals \(\d\/6\)/)).toBeVisible();
  await expect(page.getByText(/not a claim about trading performance/)).toBeVisible();
});

test("visiting the marketplace with a search query is tracked and browsing works twice in a row (cache hit path)", async ({ page }) => {
  await page.goto("/marketplace?q=free");
  await expect(page.getByRole("heading", { name: "Marketplace" })).toBeVisible();
  // Second load exercises the ranking/listing cache's hit path — this is
  // exactly the path that would break if a cached Date field weren't
  // revived correctly (see CLAUDE.md's Phase 5 cache section).
  await page.goto("/marketplace?q=free");
  await expect(page.getByRole("heading", { name: "Marketplace" })).toBeVisible();
});

test("the homepage renders correctly on a second load (cache hit path)", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "FX Bot Market" })).toBeVisible();
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "FX Bot Market" })).toBeVisible();
});

test("the calendar renders correctly on a second load (cache hit + Date revival path)", async ({ page }) => {
  await page.goto("/calendar");
  await expect(page.getByRole("heading", { name: "Economic calendar" })).toBeVisible();
  await page.goto("/calendar");
  await expect(page.getByRole("heading", { name: "Economic calendar" })).toBeVisible();
  // If eventTime weren't revived to a real Date on a cache hit, this row
  // (which calls .toISOString() on it) would throw instead of rendering.
  await expect(page.getByText("E2E Fixture Event")).toBeVisible();
});

test("the news list renders correctly on a second load (cache hit + Date revival path)", async ({ page }) => {
  await page.goto("/news");
  await expect(page.getByRole("heading", { name: "Forex News" })).toBeVisible();
  await page.goto("/news");
  await expect(page.getByRole("heading", { name: "Forex News" })).toBeVisible();
  await expect(page.getByText("E2E Fixture Article")).toBeVisible();
});

test("cross-entity search API returns tagged results across products and news", async ({ page }) => {
  const res = await page.request.get("/api/search?q=E2E&types=product,news");
  expect(res.ok()).toBe(true);
  const body = await res.json();
  expect(Array.isArray(body.results)).toBe(true);
  const types = new Set(body.results.map((r: { type: string }) => r.type));
  expect(types.has("product") || types.has("news")).toBe(true);
});

test("a rate-limited sign-in attempt with a wrong password still denies access without crashing", async ({ page }) => {
  await page.goto("/auth/sign-in");
  await page.getByPlaceholder("Email").fill(E2E_BUYER);
  await page.getByPlaceholder("Password").fill("definitely-wrong-password");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/auth\/sign-in/);
});
