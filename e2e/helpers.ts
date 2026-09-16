import type { Page } from "@playwright/test";

export async function signIn(page: Page, email: string, password = "password123") {
  await page.goto("/auth/sign-in");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(/\/marketplace$/);
}

export const E2E_BUYER = "e2e-buyer@fxbotmarket.local";
export const E2E_SELLER = "e2e-seller@fxbotmarket.local";
export const E2E_ADMIN = "e2e-admin@fxbotmarket.local";
