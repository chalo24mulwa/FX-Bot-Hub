import { test, expect } from "@playwright/test";

// Selectors use getByLabel (matching each field's <label htmlFor>) rather
// than getByPlaceholder — placeholder text is copy, and changed under this
// same redesign once already (see auth.ts's "Calendar enhancement" siblings
// for the same lesson elsewhere in this codebase: don't couple a test to
// text that isn't the actual contract). The label is the stable, accessible
// anchor.

test("a new user can sign up, sign out, and sign back in", async ({ page }) => {
  const email = `e2e-signup-${Date.now()}@fxbotmarket.local`;

  await page.goto("/auth/sign-up");
  await page.getByLabel("Name").fill("New E2E User");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill("password123");
  await page.getByRole("button", { name: "Sign up" }).click();

  await expect(page).toHaveURL(/\/auth\/sign-in$/);

  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill("password123");
  await page.getByRole("button", { name: "Sign in" }).click();

  await expect(page).toHaveURL(/\/marketplace$/);

  await page.goto("/dashboard");
  await expect(page.getByRole("heading", { name: /Welcome back/ })).toBeVisible();

  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page.getByRole("link", { name: "Sign in" })).toBeVisible();
});

test("wrong password is rejected", async ({ page }) => {
  await page.goto("/auth/sign-in");
  await page.getByLabel("Email").fill("e2e-buyer@fxbotmarket.local");
  await page.getByLabel("Password", { exact: true }).fill("wrong-password");
  await page.getByRole("button", { name: "Sign in" }).click();

  await expect(page.getByText("Invalid email or password.")).toBeVisible();
});

test("the password visibility toggle switches a password field to plain text and back", async ({ page }) => {
  await page.goto("/auth/sign-in");
  const passwordField = page.getByLabel("Password", { exact: true });
  await passwordField.fill("some-password");
  await expect(passwordField).toHaveAttribute("type", "password");

  await page.getByRole("button", { name: "Show password" }).click();
  await expect(passwordField).toHaveAttribute("type", "text");

  await page.getByRole("button", { name: "Hide password" }).click();
  await expect(passwordField).toHaveAttribute("type", "password");
});

test("forgot password shows the same generic confirmation for a registered and an unregistered email", async ({ page }) => {
  // Never reveals which case actually happened — that's the point (see
  // src/features/auth/password-reset-service.ts).
  await page.goto("/auth/forgot-password");
  await page.getByLabel("Email").fill("e2e-buyer@fxbotmarket.local");
  await page.getByRole("button", { name: "Send reset link" }).click();
  await expect(page.getByText(/we've sent instructions to reset your password/)).toBeVisible();

  await page.goto("/auth/forgot-password");
  await page.getByLabel("Email").fill(`no-such-user-${Date.now()}@fxbotmarket.local`);
  await page.getByRole("button", { name: "Send reset link" }).click();
  await expect(page.getByText(/we've sent instructions to reset your password/)).toBeVisible();
});

test("reset-password with no token shows an invalid-link state instead of a broken form", async ({ page }) => {
  await page.goto("/auth/reset-password");
  await expect(page.getByRole("heading", { name: "Invalid reset link" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Request a new link" })).toBeVisible();
});

test("reset-password rejects a bogus token with a clear error, and does not change the real account's password", async ({ page }) => {
  await page.goto("/auth/reset-password?token=" + "0".repeat(64));
  await page.getByLabel("New password", { exact: true }).fill("brandNewPassword123");
  await page.getByLabel("Confirm new password").fill("brandNewPassword123");
  await page.getByRole("button", { name: "Reset password" }).click();

  await expect(page.getByText(/invalid or has expired/)).toBeVisible();

  // The real account's original password must still work.
  await page.goto("/auth/sign-in");
  await page.getByLabel("Email").fill("e2e-buyer@fxbotmarket.local");
  await page.getByLabel("Password", { exact: true }).fill("password123");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/marketplace$/);
});

test("Continue with Google is visible on both sign-in and sign-up, and never sends a visitor to a dead end", async ({ page, request }) => {
  // Shown whether or not the server has Google credentials. Without them (CI, and
  // production until AUTH_GOOGLE_ID/SECRET are set) clicking explains that instead of
  // redirecting to an Auth.js error page; with them it starts the real OAuth flow.
  const configured = Boolean((await (await request.get("/api/auth/providers")).json()).google);
  for (const path of ["/auth/sign-in", "/auth/sign-up"]) {
    await page.goto(path);
    const button = page.getByRole("button", { name: "Continue with Google" });
    await expect(button).toBeVisible();
    if (!configured) {
      await button.click();
      await expect(page.getByRole("status")).toContainText("isn't switched on");
      await expect(page).toHaveURL(new RegExp(path + "$"));
    }
  }
});
