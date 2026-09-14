import { test, expect } from "@playwright/test";
import { signIn, E2E_SELLER, E2E_ADMIN } from "./helpers";

test("a seller can create a product through the wizard, submit it, and an admin can approve it", async ({
  browser,
}) => {
  const productName = `E2E Wizard Product ${Date.now()}`;

  const sellerContext = await browser.newContext();
  const sellerPage = await sellerContext.newPage();
  await signIn(sellerPage, E2E_SELLER);

  await sellerPage.goto("/seller/products/new");
  // Scoped to <main> throughout: Next.js's own floating dev-tools button
  // has an accessible name ("Open Next.js Dev Tools") that also matches a
  // substring search for "Next", colliding with the wizard's Next button.
  const next = sellerPage.locator("main").getByRole("button", { name: "Next", exact: true });

  // Step 1: product type — default EA is fine, advance.
  await next.click();
  // Step 2: platform — default MT5, advance.
  await next.click();
  // Step 3: basic information.
  await sellerPage.getByLabel("Product name").fill(productName);
  await sellerPage.getByLabel("Short summary").fill("An end-to-end test product short summary.");
  await next.click();
  // Step 4: description.
  await sellerPage.getByLabel("Description").fill("This product was created entirely by a Playwright end-to-end test.");
  await next.click();
  // Step 5: features -> leaving this step creates the draft.
  await next.click();
  await expect(sellerPage.getByText(/uploaded so far/)).toBeVisible();

  // Steps 6-8 (uploads) are optional — skip straight through to pricing.
  await next.click(); // screenshots
  await next.click(); // documentation
  await next.click(); // files
  // Step 9: pricing — leave as Free.
  await sellerPage.locator("main").getByRole("button", { name: "Free", exact: true }).click();
  await next.click();
  // Step 10: compatibility.
  await next.click();
  // Step 11: testing & support.
  await next.click();
  // Step 12: submit for review.
  await sellerPage.getByRole("button", { name: "Submit for review" }).click();

  await expect(sellerPage.getByText("PENDING REVIEW")).toBeVisible({ timeout: 10_000 });
  await sellerContext.close();

  const adminContext = await browser.newContext();
  const adminPage = await adminContext.newPage();
  await signIn(adminPage, E2E_ADMIN);
  await adminPage.goto("/admin/products?status=PENDING_REVIEW");
  await expect(adminPage.getByText(productName)).toBeVisible();

  const row = adminPage.locator("tr", { hasText: productName });
  await row.getByRole("button", { name: "Approve" }).click();
  await expect(adminPage.getByText(productName)).toHaveCount(0, { timeout: 10_000 });
  await adminContext.close();
});
