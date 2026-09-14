import { test, expect } from "@playwright/test";

test("a new user can sign up, sign out, and sign back in", async ({ page }) => {
  const email = `e2e-signup-${Date.now()}@fxbotmarket.local`;

  await page.goto("/auth/sign-up");
  await page.getByPlaceholder("Name").fill("New E2E User");
  await page.getByPlaceholder("Email").fill(email);
  await page.getByPlaceholder("Password").fill("password123");
  await page.getByRole("button", { name: "Sign up" }).click();

  await expect(page).toHaveURL(/\/auth\/sign-in$/);

  await page.getByPlaceholder("Email").fill(email);
  await page.getByPlaceholder("Password").fill("password123");
  await page.getByRole("button", { name: "Sign in" }).click();

  await expect(page).toHaveURL(/\/marketplace$/);

  await page.goto("/dashboard");
  await expect(page.getByRole("heading", { name: /Welcome back/ })).toBeVisible();

  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page.getByRole("link", { name: "Sign in" })).toBeVisible();
});

test("wrong password is rejected", async ({ page }) => {
  await page.goto("/auth/sign-in");
  await page.getByPlaceholder("Email").fill("e2e-buyer@fxbotmarket.local");
  await page.getByPlaceholder("Password").fill("wrong-password");
  await page.getByRole("button", { name: "Sign in" }).click();

  await expect(page.getByText("Invalid email or password.")).toBeVisible();
});
