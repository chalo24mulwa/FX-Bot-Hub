import { test, expect } from "@playwright/test";
import { signIn } from "./helpers";

// Regression test: role changes must take effect in the current session
// immediately, not only after the next sign-in. becomeSellerAction calls
// updateSession() specifically so this redirect doesn't race a stale JWT.
test("a user can become a seller and land straight on the seller dashboard", async ({ page }) => {
  const email = `e2e-become-seller-${Date.now()}@fxbotmarket.local`;

  await page.goto("/auth/sign-up");
  await page.getByLabel("Name").fill("Future Seller");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill("password123");
  await page.getByRole("button", { name: "Sign up" }).click();
  await page.waitForURL(/\/auth\/sign-in$/);

  await signIn(page, email);

  await page.goto("/dashboard/become-seller");
  await page.getByPlaceholder("e.g. Apex Algo Systems").fill("Future Seller Co.");
  await page.getByRole("button", { name: "Start selling" }).click();

  await expect(page).toHaveURL(/\/seller$/, { timeout: 10_000 });
  await expect(page.getByRole("heading", { name: "Overview" })).toBeVisible();
});
