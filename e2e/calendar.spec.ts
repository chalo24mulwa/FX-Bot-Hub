import { test, expect } from "@playwright/test";
import { signIn, E2E_BUYER } from "./helpers";

test("the calendar lists the seeded event and filtering by impact keeps it visible", async ({ page }) => {
  await page.goto("/calendar");
  await expect(page.getByRole("heading", { name: "Economic calendar" })).toBeVisible();
  await expect(page.getByText("E2E Fixture Event")).toBeVisible();

  await page.getByRole("button", { name: "HIGH", exact: true }).click();
  await expect(page).toHaveURL(/impact=HIGH/);
  await expect(page.getByText("E2E Fixture Event")).toBeVisible();
});

test("filtering the calendar to a currency that has no match hides the fixture event", async ({ page }) => {
  await page.goto("/calendar");
  await page.getByRole("button", { name: "MEDIUM", exact: true }).click();
  await expect(page).toHaveURL(/impact=MEDIUM/);
  await expect(page.getByText("E2E Fixture Event")).not.toBeVisible();
});

test("a signed-in user can open the event detail page and subscribe to a reminder", async ({ page }) => {
  await signIn(page, E2E_BUYER);
  await page.goto("/calendar");
  const row = page.getByRole("row", { name: /E2E Fixture Event/ });
  await expect(row).toBeVisible();
  await row.getByRole("link", { name: "E2E Fixture Event" }).click();

  await expect(page).toHaveURL(/\/calendar\/event\//);
  await expect(page.getByRole("heading", { name: "E2E Fixture Event" })).toBeVisible();

  // The fixture event and E2E_BUYER are both fixed/reused across runs, so
  // this alert subscription may already exist from a previous run — assert
  // the toggle flips, not a specific direction.
  const remindButton = page.getByRole("button", { name: /Remind me before this event/ });
  const wasSubscribed = ((await remindButton.textContent()) ?? "").includes("✓");
  await remindButton.click();
  if (wasSubscribed) {
    await expect(page.getByRole("button", { name: "Remind me before this event" })).toBeVisible({ timeout: 10_000 });
  } else {
    await expect(page.getByRole("button", { name: /✓ Remind me before this event/ })).toBeVisible({ timeout: 10_000 });
  }
});
