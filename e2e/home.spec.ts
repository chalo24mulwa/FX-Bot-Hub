import { test, expect } from "@playwright/test";

test("home page links to the marketplace", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "fx Bot Hub" })).toBeVisible();
  await page.getByRole("link", { name: "Browse the marketplace" }).click();
  await expect(page).toHaveURL(/\/marketplace$/);
});

test("the menu bar has a News Calendar link between Insights and Resources", async ({ page }) => {
  await page.goto("/");
  const bar = page.getByRole("navigation", { name: "Primary" });
  const labels = await bar.locator(":scope > div > button, :scope > a").allTextContents();
  expect(labels.map((label) => label.trim())).toEqual(["Marketplace", "Insights", "News Calendar", "Resources", "Best Brokers", "VPS", "Community"]);

  await bar.getByRole("link", { name: "News Calendar", exact: true }).click();
  await expect(page).toHaveURL(/\/calendar$/);
  await expect(page.getByRole("heading", { name: "News Calendar" })).toBeVisible();
});

test("on a phone the News Calendar link is in the menu, between Insights and Resources", async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 375, height: 812 } });
  const page = await context.newPage();
  await page.goto("/");
  await page.getByRole("button", { name: "Toggle menu" }).click();
  const menu = page.locator("header").locator("div.xl\\:hidden");
  const text = await menu.innerText();
  // The standalone link comes after the Insights group's own links (the last of which is
  // "Market Analysis") and before the Resources heading.
  const standalone = text.lastIndexOf("News Calendar");
  expect(text.indexOf("Market Analysis")).toBeGreaterThan(-1);
  expect(standalone).toBeGreaterThan(text.indexOf("Market Analysis"));
  expect(standalone).toBeLessThan(text.toUpperCase().indexOf("RESOURCES"));
  await context.close();
});

test("the Insights page keeps its original /intelligence address and shows the new name", async ({ page }) => {
  await page.goto("/");
  const bar = page.getByRole("navigation", { name: "Primary" });
  await bar.getByRole("button", { name: "Insights", exact: true }).click();
  await bar.getByRole("link", { name: "Dashboard", exact: true }).click();
  await expect(page).toHaveURL(/\/intelligence$/);
  await expect(page.getByRole("heading", { name: "Insights", level: 1 })).toBeVisible();
  await expect(page).toHaveTitle("Insights Dashboard | FX Bot Hub");
  await expect(page.getByText("Market Intelligence", { exact: false }).first()).toHaveCount(0);
  // The footer column carries the new name too.
  await expect(page.locator("footer").getByText("Insights", { exact: true })).toBeVisible();
});

test("the homepage title and intro use the new Insights wording", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle("FX Bot Hub — Forex Trading Tools and Insights");
  await expect(page.getByText("Forex trading tools and market insights:", { exact: false })).toBeVisible();
  expect(await page.locator('meta[property="og:title"]').first().getAttribute("content")).toBe("Forex Trading Tools and Insights | FX Bot Hub");
});
