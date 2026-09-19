import { test, expect } from "@playwright/test";
import { signIn, E2E_SELLER } from "./helpers";

// 1x1 transparent PNG — a real, valid image that passes the client-side
// type/size pre-check without shipping a fixture file.
const TINY_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
  "base64"
);

// CI has no MinIO/S3 (see product-lifecycle.spec.ts), so this deliberately
// never asserts that an upload *succeeded* — a developer with local MinIO
// running would get a success, CI gets a graceful failure, and both are
// correct. What it pins down is the part that's environment-independent:
// the cover control exists above the title field, validates the file, shows
// a preview, and never blocks listing the rest of the product.
test("the product wizard offers a cover photo above the product name, and it never blocks the listing", async ({
  page,
}) => {
  await signIn(page, E2E_SELLER);
  await page.goto("/seller/products/new");
  const next = page.locator("main").getByRole("button", { name: "Next", exact: true });
  await next.click(); // type
  await next.click(); // platform

  // Basic information step: cover photo control sits above "Product name".
  const coverLabel = page.getByText("Cover photo", { exact: false }).first();
  const nameField = page.getByLabel("Product name");
  await expect(coverLabel).toBeVisible();
  const coverBox = await coverLabel.boundingBox();
  const nameBox = await nameField.boundingBox();
  expect(coverBox!.y).toBeLessThan(nameBox!.y);

  const fileInput = page.locator("#cover-photo-input");

  // A non-image is rejected with a clear message, before any upload starts.
  await fileInput.setInputFiles({ name: "notes.txt", mimeType: "text/plain", buffer: Buffer.from("hello") });
  await expect(page.locator("main").getByRole("alert")).toContainText("PNG, JPG, or WebP");

  // A valid image clears the error and shows a preview.
  await fileInput.setInputFiles({ name: "cover.png", mimeType: "image/png", buffer: TINY_PNG });
  await expect(page.locator("main").getByRole("alert")).toHaveCount(0);
  await expect(page.getByAltText("Cover photo preview")).toBeVisible();

  const productName = `E2E Cover Product ${Date.now()}`;
  await nameField.fill(productName);
  await page.getByLabel("Short summary").fill("An end-to-end test product with a cover photo.");
  await next.click();
  await page.getByLabel("Description").fill("Created by a Playwright test exercising the cover photo control.");
  await next.click();
  await next.click(); // features -> creates the draft (and tries the cover upload in the background)
  await expect(page.getByText(/uploaded so far/)).toBeVisible();

  // Walk to the last step: whatever the cover upload did, listing must still be possible.
  for (let i = 0; i < 6; i++) await next.click();
  await expect(page.getByAltText("Cover photo", { exact: true })).toBeVisible();
  await expect(page.locator("main").getByRole("button", { name: "Submit for review" })).toBeEnabled();
});

test("products without a cover photo still render on the marketplace with the placeholder", async ({ page }) => {
  await page.goto("/marketplace");
  // The seeded e2e fixtures have no cover — the card must fall back, not break.
  await expect(page.getByText("No image").first()).toBeVisible();
});
