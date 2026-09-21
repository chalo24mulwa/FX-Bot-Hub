import { test, expect } from "@playwright/test";
import { signIn, E2E_BUYER } from "./helpers";

test("the calendar lists the seeded event and filtering by impact keeps it visible", async ({ page }) => {
  await page.goto("/calendar");
  await expect(page.getByRole("heading", { name: "News Calendar" })).toBeVisible();
  await expect(page.getByText("E2E Fixture Event")).toBeVisible();

  await page.getByRole("button", { name: "High", exact: true }).click();
  await expect(page).toHaveURL(/impact=HIGH/);
  await expect(page.getByText("E2E Fixture Event")).toBeVisible();
});

test("filtering the calendar to a currency that has no match hides the fixture event", async ({ page }) => {
  await page.goto("/calendar");
  await page.getByRole("button", { name: "Medium", exact: true }).click();
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

// --- Terminal-style layout: sticky sidebar / mobile drawer -------------------
// The sidebar is ONE element restyled at the `lg` breakpoint (see
// calendar-filters.tsx), so these tests drive the same controls on both sizes.

const sidebar = (page: import("@playwright/test").Page) => page.locator("aside[aria-label='Calendar filters']");

test("the desktop sidebar exposes every filter group, counts active filters, and Clear filters resets them", async ({ page }) => {
  await page.goto("/calendar");
  const aside = sidebar(page);
  await expect(aside).toBeInViewport();
  for (const heading of ["Calendar", "Impact", "Categories", "Currency"]) {
    await expect(aside.getByRole("heading", { name: heading, exact: true })).toBeVisible();
  }
  // The currency list is the specified majors, in order.
  const codes = await aside.locator("section[aria-label='Currency'] button").allTextContents();
  expect(codes.slice(0, 13)).toEqual(["USD", "EUR", "GBP", "JPY", "AUD", "CAD", "CHF", "NZD", "CNY", "SEK", "NOK", "INR", "HKD"]);

  await aside.getByRole("button", { name: "USD", exact: true }).click();
  await expect(page).toHaveURL(/currency=USD/);
  await aside.getByRole("button", { name: "High", exact: true }).click();
  await expect(page).toHaveURL(/impact=HIGH/);
  await expect(aside.getByText("2 filters active")).toBeVisible();

  await aside.getByRole("button", { name: "Clear filters" }).click();
  await expect(page).not.toHaveURL(/currency=|impact=/);
  await expect(aside.getByText(/filters? active/)).toHaveCount(0);
});

test("quick ranges navigate, mark themselves current, and keep the active filters", async ({ page }) => {
  await page.goto("/calendar?impact=HIGH");
  const aside = sidebar(page);
  await aside.getByRole("button", { name: "Next 3 Months", exact: true }).click();
  await expect(page).toHaveURL(/preset=range/);
  await expect(page).toHaveURL(/nav=quarter/);
  await expect(page).toHaveURL(/impact=HIGH/);
  await expect(aside.getByRole("button", { name: "Next 3 Months", exact: true })).toHaveAttribute("aria-current", "true");

  await aside.getByRole("button", { name: "Tomorrow", exact: true }).click();
  await expect(page).toHaveURL(/preset=tomorrow/);
  await expect(page).not.toHaveURL(/nav=/);
  await expect(aside.getByRole("button", { name: "Tomorrow", exact: true })).toHaveAttribute("aria-current", "true");
});

test("the timezone picker in the header re-renders the time column in that zone", async ({ page }) => {
  await page.goto("/calendar");
  await expect(page.getByRole("columnheader", { name: /^Time \(/ })).toBeVisible();
  await page.getByLabel("Timezone", { exact: true }).selectOption("UTC");
  await expect(page).toHaveURL(/tz=UTC/);
  await expect(page.getByRole("columnheader", { name: "Time (UTC)" })).toBeVisible();
});

test.describe("on a phone", () => {
  test.use({ viewport: { width: 375, height: 812 } });

  test("the sidebar is a drawer opened from a Filters bar, and the table scrolls inside itself", async ({ page }) => {
    await page.goto("/calendar");
    const aside = sidebar(page);
    await expect(aside).not.toBeInViewport();

    // The page itself never scrolls sideways; only the table does.
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

    await page.getByRole("button", { name: /^Filters/ }).click();
    await expect(aside).toBeInViewport();
    await expect(page.getByRole("dialog", { name: "Calendar filters" })).toBeVisible();

    await aside.getByRole("button", { name: "USD", exact: true }).click();
    await expect(page).toHaveURL(/currency=USD/);
    await expect(aside).toBeInViewport(); // stays open while toggling several filters

    await page.keyboard.press("Escape");
    await expect(aside).not.toBeInViewport();
    await expect(page.getByRole("button", { name: /^Filters.*1 active/ })).toBeVisible();
  });
});
