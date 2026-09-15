import { test, expect } from "@playwright/test";
import { signIn, E2E_BUYER } from "./helpers";

test("a user can become a signal provider, publish a signal, and a buyer can subscribe for free", async ({ page }) => {
  const suffix = Date.now();
  const email = `e2e-signal-provider-${suffix}@fxbotmarket.local`;
  const displayName = `E2E Provider ${suffix}`;
  const instrument = "EURUSD";

  await page.goto("/auth/sign-up");
  await page.getByPlaceholder("Name").fill("E2E Signal Provider");
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
  // Plain server-action form with no redirect and no pending-state UI — the
  // click resolves as soon as the event dispatches, before the mutation's
  // round trip finishes. Wait for the network to settle so the following
  // navigation reads post-commit state, not a race against the write.
  await page.waitForLoadState("networkidle");
  await expect(page.getByRole("heading", { name: "Publish a signal" })).toBeVisible({ timeout: 10_000 });

  await page.goto("/signals");
  await expect(page.getByText(displayName)).toBeVisible();
  await expect(page.getByText(instrument).first()).toBeVisible();

  await signIn(page, E2E_BUYER);
  await page.goto("/signals");
  await page.getByText(displayName).click();
  await expect(page).toHaveURL(/\/signals\/provider\//);

  await page.getByRole("button", { name: "Subscribe for free" }).click();
  await expect(page.getByText("✓ Subscribed")).toBeVisible({ timeout: 10_000 });

  await page.goto("/dashboard/subscriptions");
  const subscriptionRow = page.getByRole("listitem").filter({ hasText: displayName });
  await expect(subscriptionRow).toBeVisible();
  await expect(subscriptionRow.getByText("ACTIVE")).toBeVisible();
});
