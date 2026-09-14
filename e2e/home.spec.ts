import { test, expect } from "@playwright/test";

test("home page links to the marketplace", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "FX Bot Market" })).toBeVisible();
  await page.getByRole("link", { name: "Browse the marketplace" }).click();
  await expect(page).toHaveURL(/\/marketplace$/);
});
