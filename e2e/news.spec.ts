import { test, expect } from "@playwright/test";

test("the news list shows the seeded article with its source attribution", async ({ page }) => {
  await page.goto("/news");
  await expect(page.getByRole("heading", { name: "Forex News" })).toBeVisible();
  await expect(page.getByText("E2E Fixture Article")).toBeVisible();
  await expect(page.getByText("E2E Wire", { exact: false })).toBeVisible();
});

test("filtering news by category keeps the seeded article visible", async ({ page }) => {
  await page.goto("/news");
  await page.getByRole("link", { name: "E2E News Category", exact: true }).click();
  await expect(page).toHaveURL(/category=e2e-news-category/);
  await expect(page.getByText("E2E Fixture Article")).toBeVisible();
});

test("opening an article shows its summary and links back to the source, not a full-text copy", async ({ page }) => {
  await page.goto("/news");
  await page.getByText("E2E Fixture Article").click();
  await expect(page).toHaveURL(/\/news\/e2e-fixture-article/);
  await expect(page.getByText("Seeded for Playwright — safe to leave in the database.")).toBeVisible();
  await expect(page.getByRole("link", { name: /Read the full article at/i })).toBeVisible();
});
