import { test, expect, type Page } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { generateResetToken, RESET_TOKEN_TTL_MS } from "../src/lib/security/password-reset-token";

// The emailed link can't be read in CI (no mailbox, and the console email provider
// only logs), so these tests mint reset tokens the same way the app does — the
// pure generateResetToken() helper + a PasswordResetToken row — and then drive the
// real reset page, API and sign-in. What is covered: the form, single-use,
// invalidation of sibling links, expiry, and that the new password (and only it)
// signs in afterwards. Who gets *emailed* is covered by the unit tests and the
// enumeration test in auth.spec.ts.

const db = new PrismaClient();
test.afterAll(async () => {
  await db.$disconnect();
});

async function signUp(page: Page, email: string, password: string) {
  await page.goto("/auth/sign-up");
  await page.getByLabel("Name").fill("Reset Flow User");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign up" }).click();
  await expect(page).toHaveURL(/\/auth\/sign-in$/);
}

async function tokenFor(email: string, expiresInMs = RESET_TOKEN_TTL_MS) {
  const user = await db.user.findFirstOrThrow({ where: { email: { equals: email, mode: "insensitive" } } });
  const { token, tokenHash } = generateResetToken();
  await db.passwordResetToken.create({ data: { userId: user.id, tokenHash, expiresAt: new Date(Date.now() + expiresInMs) } });
  return token;
}

async function submitNewPassword(page: Page, token: string, password: string, confirm = password) {
  await page.goto(`/auth/reset-password?token=${token}`);
  await page.getByLabel("New password", { exact: true }).fill(password);
  await page.getByLabel("Confirm new password").fill(confirm);
  await page.getByRole("button", { name: "Reset password" }).click();
}

async function signInAs(page: Page, email: string, password: string) {
  await page.goto("/auth/sign-in");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
}

test("a reset link works once, kills its sibling links, and only the new password signs in afterwards", async ({ page }) => {
  const email = `e2e-reset-${Date.now()}@fxbotmarket.local`;
  await signUp(page, email, "originalPass1");

  const used = await tokenFor(email);
  const sibling = await tokenFor(email); // a second, still-unused request for the same account

  // Client-side checks come first and never reach the server.
  await page.goto(`/auth/reset-password?token=${used}`);
  await page.getByLabel("New password", { exact: true }).fill("brandNewPass42");
  await page.getByLabel("Confirm new password").fill("somethingElse99");
  await page.getByRole("button", { name: "Reset password" }).click();
  await expect(page.getByText("Passwords don't match.")).toBeVisible();

  // The eye toggle reveals and re-hides the field.
  const field = page.getByLabel("New password", { exact: true });
  await page.getByRole("button", { name: "Show password" }).first().click();
  await expect(field).toHaveAttribute("type", "text");
  await page.getByRole("button", { name: "Hide password" }).first().click();
  await expect(field).toHaveAttribute("type", "password");

  await page.getByLabel("Confirm new password").fill("brandNewPass42");
  await page.getByRole("button", { name: "Reset password" }).click();
  await expect(page.getByText("Your password has been changed")).toBeVisible({ timeout: 15_000 });

  // Single use — and using one link retires every other outstanding link.
  await submitNewPassword(page, used, "yetAnotherPass7");
  await expect(page.getByText(/invalid or has expired/)).toBeVisible();
  await submitNewPassword(page, sibling, "yetAnotherPass7");
  await expect(page.getByText(/invalid or has expired/)).toBeVisible();

  // The old password is dead, the new one works, and the rejected attempts changed nothing.
  await signInAs(page, email, "originalPass1");
  await expect(page.getByText("Invalid email or password.")).toBeVisible();
  await signInAs(page, email, "brandNewPass42");
  await expect(page).toHaveURL(/\/marketplace$/);
});

test("an expired reset link is rejected and leaves the password unchanged", async ({ page }) => {
  const email = `e2e-reset-expired-${Date.now()}@fxbotmarket.local`;
  await signUp(page, email, "originalPass1");

  const expired = await tokenFor(email, -60_000);
  await submitNewPassword(page, expired, "brandNewPass42");
  await expect(page.getByText(/invalid or has expired/)).toBeVisible();

  await signInAs(page, email, "originalPass1");
  await expect(page).toHaveURL(/\/marketplace$/);
});

test("email addresses are matched regardless of letter case: no duplicate accounts, sign-in works either way", async ({ page }) => {
  const stamp = Date.now();
  const typed = `E2E.Case.${stamp}@FxBotMarket.local`;
  await signUp(page, typed, "originalPass1");

  // Stored normalised…
  const row = await db.user.findFirstOrThrow({ where: { email: { equals: typed, mode: "insensitive" } } });
  expect(row.email).toBe(typed.toLowerCase());

  // …a second sign-up that differs only by case is a duplicate…
  await page.goto("/auth/sign-up");
  await page.getByLabel("Name").fill("Case Twin");
  await page.getByLabel("Email").fill(typed.toLowerCase());
  await page.getByLabel("Password", { exact: true }).fill("originalPass1");
  await page.getByRole("button", { name: "Sign up" }).click();
  await expect(page.getByText("An account with this email already exists.")).toBeVisible();
  expect(await db.user.count({ where: { email: { equals: typed, mode: "insensitive" } } })).toBe(1);

  // …and sign-in works however the address is typed.
  await signInAs(page, typed, "originalPass1");
  await expect(page).toHaveURL(/\/marketplace$/);
});
