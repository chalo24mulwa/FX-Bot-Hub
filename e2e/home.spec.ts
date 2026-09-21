import { test, expect } from "@playwright/test";

test("home page links to the marketplace", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "fx Bot Hub" })).toBeVisible();
  await page.getByRole("link", { name: "Browse the marketplace" }).click();
  await expect(page).toHaveURL(/\/marketplace$/);
});

test("the menu bar has a News Calendar link between Market Intelligence and Resources", async ({ page }) => {
  await page.goto("/");
  const bar = page.getByRole("navigation", { name: "Primary" });
  const labels = await bar.locator(":scope > div > button, :scope > a").allTextContents();
  expect(labels.map((label) => label.trim())).toEqual(["Marketplace", "Market Intelligence", "News Calendar", "Resources", "Community"]);

  await bar.getByRole("link", { name: "News Calendar", exact: true }).click();
  await expect(page).toHaveURL(/\/calendar$/);
  await expect(page.getByRole("heading", { name: "News Calendar" })).toBeVisible();
});

test("on a phone the News Calendar link is in the menu, between Market Intelligence and Resources", async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 375, height: 812 } });
  const page = await context.newPage();
  await page.goto("/");
  await page.getByRole("button", { name: "Toggle menu" }).click();
  const menu = page.locator("header").locator("div.xl\\:hidden");
  const text = await menu.innerText();
  // The standalone link comes after the Market Intelligence group's own links (the last of which is
  // "Market Analysis") and before the Resources heading.
  const standalone = text.lastIndexOf("News Calendar");
  expect(text.indexOf("Market Analysis")).toBeGreaterThan(-1);
  expect(standalone).toBeGreaterThan(text.indexOf("Market Analysis"));
  expect(standalone).toBeLessThan(text.toUpperCase().indexOf("RESOURCES"));
  await context.close();
});
