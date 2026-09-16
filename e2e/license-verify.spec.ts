import { test, expect } from "@playwright/test";
import { signIn } from "./helpers";

test("a license key can be verified, activated, and deactivated through the license API", async ({ page }) => {
  const email = `e2e-license-buyer-${Date.now()}@fxbotmarket.local`;

  await page.goto("/auth/sign-up");
  await page.getByLabel("Name").fill("E2E License Buyer");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill("password123");
  await page.getByRole("button", { name: "Sign up" }).click();
  await page.waitForURL(/\/auth\/sign-in$/);
  await signIn(page, email);

  await page.goto("/marketplace/e2e-free-product");
  const ownedLabel = page.getByText("You own this product");
  if (!(await ownedLabel.isVisible().catch(() => false))) {
    await page.getByRole("button", { name: /Get for free/ }).click();
    await expect(page).toHaveURL(/\/cart$/);
    await page.getByRole("button", { name: "Checkout" }).click();
    await expect(page).toHaveURL(/\/dashboard\/orders\//, { timeout: 15_000 });
  }

  await page.goto("/dashboard/licenses");
  const row = page.getByText("E2E Free Product").locator("xpath=ancestor::li");
  await expect(row).toBeVisible();
  const keyText = await row.locator("p.font-mono").textContent();
  const licenseKey = keyText!.trim();
  expect(licenseKey.length).toBeGreaterThan(0);

  const verifyRes = await page.request.post("/api/licenses/verify", { data: { licenseKey } });
  expect(verifyRes.ok()).toBe(true);
  const verifyBody = await verifyRes.json();
  expect(verifyBody.valid).toBe(true);
  expect(verifyBody.status).toBe("ACTIVE");

  const machineId = `e2e-machine-${Date.now()}`;
  const activateRes = await page.request.post("/api/licenses/activate", { data: { licenseKey, machineId } });
  expect(activateRes.ok()).toBe(true);
  expect((await activateRes.json()).activated).toBe(true);

  // Re-activating the same machineId is idempotent, not a second slot used.
  const reactivateRes = await page.request.post("/api/licenses/activate", { data: { licenseKey, machineId } });
  expect(reactivateRes.ok()).toBe(true);

  const deactivateRes = await page.request.post("/api/licenses/deactivate", { data: { licenseKey, machineId } });
  expect(deactivateRes.ok()).toBe(true);
  expect((await deactivateRes.json()).deactivated).toBe(true);

  const badVerifyRes = await page.request.post("/api/licenses/verify", { data: { licenseKey: "not-a-real-key" } });
  expect(badVerifyRes.ok()).toBe(true);
  expect((await badVerifyRes.json()).valid).toBe(false);
});
