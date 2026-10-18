import { test, expect } from "@playwright/test";
import { signIn, E2E_SELLER } from "./helpers";

// Prices are typed in dollars ("49.00") and stored as cents; sellers never see or type cents.

test("a seller prices a product in dollars in the wizard and on the edit page", async ({ page }) => {
  await signIn(page, E2E_SELLER);
  await page.goto("/seller/products/new");
  const next = page.locator("main").getByRole("button", { name: "Next", exact: true });
  await next.click(); // type
  await next.click(); // platform
  await page.getByLabel("Product name").fill(`E2E Price Product ${Date.now()}`);
  await page.getByLabel("Short summary").fill("An end-to-end test product for dollar pricing.");
  await next.click();
  await page.getByLabel("Description").fill("Created by a Playwright test exercising the dollar price field.");
  await next.click(); // draft
  await next.click(); // screenshots
  await next.click(); // files

  // Pricing step: dollars, starting at 0.00 — no mention of cents anywhere.
  await page.locator("main").getByRole("button", { name: "One-time purchase" }).click();
  const price = page.getByLabel("Offer price (USD)");
  await expect(price).toHaveValue("0.00");
  await expect(page.locator("main")).not.toContainText(/cents/i);

  // Invalid input is flagged and blocks Next.
  await price.fill("abc");
  await expect(page.getByRole("alert").filter({ hasText: "like 49.00" })).toBeVisible();
  await next.click();
  await expect(page.getByText("Enter valid amounts in dollars")).toBeVisible();
  await price.fill("-5");
  await expect(page.getByRole("alert").filter({ hasText: "like 49.00" })).toBeVisible();

  // "49.5" is accepted and tidied to two decimals when leaving the field.
  await price.fill("49.5");
  await expect(page.getByRole("alert").filter({ hasText: "like 49.00" })).toHaveCount(0);
  await price.blur();
  await expect(price).toHaveValue("49.50");
  await next.click(); // compatibility
  await next.click(); // submit step
  await page.getByRole("button", { name: "Submit for review" }).click();
  await expect(page).toHaveURL(/\/seller\/products\/(?!new$)[a-z0-9]+$/, { timeout: 15_000 });

  // The edit page shows what was saved, in dollars; changing it round-trips.
  const edit = page.getByLabel("Offer price (USD)");
  await expect(edit).toHaveValue("49.50");
  await edit.fill("12.34");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect.poll(async () => {
    await page.reload();
    return page.getByLabel("Offer price (USD)").inputValue();
  }, { timeout: 15_000 }).toBe("12.34");

  // A value that isn't a dollar amount can't be saved (the browser blocks the form), so a wrong price never reaches the database.
  await page.getByLabel("Offer price (USD)").fill("1.999");
  await page.getByRole("button", { name: "Save changes" }).click();
  await page.reload();
  await expect(page.getByLabel("Offer price (USD)")).toHaveValue("12.34");
});
