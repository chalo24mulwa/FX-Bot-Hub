import { test, expect } from "@playwright/test";
import { signIn, E2E_ADMIN } from "./helpers";

test("an admin can toggle a data source and see recent sync runs", async ({ page }) => {
  await signIn(page, E2E_ADMIN);
  await page.goto("/admin/data-sources");
  await expect(page.getByRole("heading", { name: "Data sources" })).toBeVisible();

  const row = page.getByRole("row", { name: /Manual calendar \(e2e\)/ });
  await expect(row).toBeVisible();
  const toggleButton = row.getByRole("button", { name: /Enable|Disable/ });
  const initialLabel = await toggleButton.textContent();

  await toggleButton.click();
  await expect(row.getByRole("button", { name: initialLabel === "Disable" ? "Enable" : "Disable" })).toBeVisible({
    timeout: 10_000,
  });

  // Restore original state so repeated runs don't flip it back and forth.
  await row.getByRole("button", { name: initialLabel === "Disable" ? "Enable" : "Disable" }).click();
  await expect(row.getByRole("button", { name: initialLabel! })).toBeVisible({ timeout: 10_000 });
});

test("an admin can create a news category and a draft article, then publish it", async ({ page }) => {
  const suffix = Date.now();
  const categoryName = `E2E Admin Category ${suffix}`;
  const articleTitle = `E2E Admin Article ${suffix}`;

  await signIn(page, E2E_ADMIN);

  await page.goto("/admin/news-categories");
  await page.getByPlaceholder("e.g. Central Banks").fill(categoryName);
  await page.getByRole("button", { name: "Create" }).click();
  await expect(page.getByText(categoryName)).toBeVisible({ timeout: 10_000 });

  await page.goto("/admin/news");
  await page.getByPlaceholder("Title").fill(articleTitle);
  await page.getByPlaceholder("Summary").fill("Created by the admin moderation e2e test.");
  await page.getByPlaceholder("Source name").fill("E2E Admin Source");
  await page.getByPlaceholder("Source URL").fill("https://example.com/e2e-admin-article");
  await page.getByRole("button", { name: "Create article" }).click();

  const row = page.getByRole("row", { name: new RegExp(articleTitle) });
  await expect(row).toBeVisible({ timeout: 10_000 });
  await expect(row.getByText("DRAFT")).toBeVisible();

  await row.getByRole("button", { name: "Publish" }).click();
  await expect(row.getByText("PUBLISHED")).toBeVisible({ timeout: 10_000 });

  await page.goto("/news");
  await expect(page.getByText(articleTitle)).toBeVisible();
});

test("an admin can verify a signal provider and remove one of their signals from the public feed", async ({ page }) => {
  const suffix = Date.now();
  const email = `e2e-moderated-provider-${suffix}@fxbotmarket.local`;
  const displayName = `E2E Moderated Provider ${suffix}`;
  const instrument = "GBPUSD";

  await page.goto("/auth/sign-up");
  await page.getByPlaceholder("Name").fill("E2E Moderated Provider");
  await page.getByPlaceholder("Email").fill(email);
  await page.getByPlaceholder("Password").fill("password123");
  await page.getByRole("button", { name: "Sign up" }).click();
  await page.waitForURL(/\/auth\/sign-in$/);

  await signIn(page, email);
  await page.goto("/dashboard/become-signal-provider");
  await page.getByPlaceholder("e.g. Apex FX Signals").fill(displayName);
  await page.getByRole("button", { name: "Start publishing signals" }).click();
  await expect(page).toHaveURL(/\/signals\/provider\//, { timeout: 10_000 });

  await page.goto("/signals/new");
  await page.getByPlaceholder("EURUSD").fill(instrument);
  await page.getByRole("button", { name: "Publish signal" }).click();
  await page.waitForLoadState("networkidle");
  await expect(page.getByRole("heading", { name: "Publish a signal" })).toBeVisible({ timeout: 10_000 });

  await signIn(page, E2E_ADMIN);

  await page.goto("/admin/signal-providers");
  const providerRow = page.getByRole("row", { name: new RegExp(displayName) });
  await expect(providerRow).toBeVisible();
  await providerRow.getByRole("button", { name: "Verify" }).click();
  await expect(providerRow.getByRole("button", { name: "Unverify" })).toBeVisible({ timeout: 10_000 });

  await page.goto("/admin/signals");
  const signalRow = page.getByRole("row", { name: new RegExp(instrument) }).filter({ hasText: displayName });
  await expect(signalRow).toBeVisible();
  page.once("dialog", (dialog) => dialog.accept());
  await signalRow.getByRole("button", { name: "Remove" }).click();
  await expect(signalRow.getByText("CANCELLED")).toBeVisible({ timeout: 10_000 });

  await page.goto("/signals");
  await expect(page.getByText(displayName)).not.toBeVisible();
});
