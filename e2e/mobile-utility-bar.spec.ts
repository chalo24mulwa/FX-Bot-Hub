import { test, expect, type Browser, type Page } from "@playwright/test";

// The phone quick-links bar: pinned to the top, slides away while scrolling down, comes back the instant the visitor scrolls up
// (and at the top of the page). Phones only; tablets and desktops keep the layout they had.

const BASE = "http://localhost:3000";
const PHONE_SIZES = [
  { width: 320, height: 568 },
  { width: 375, height: 667 },
  { width: 390, height: 844 },
  { width: 430, height: 932 },
];

async function open(browser: Browser, width: number, height: number, options: { reducedMotion?: "reduce" } = {}): Promise<Page> {
  const context = await browser.newContext({ baseURL: BASE, viewport: { width, height }, ...options });
  const page = await context.newPage();
  await page.goto("/", { waitUntil: "load" });
  await waitReady(page);
  return page;
}

/** The scroll handling attaches after hydration; scrolling before that is simply not observed. */
async function waitReady(page: Page) {
  await expect(page.locator(".utility-sticky-group")).toHaveAttribute("data-ready", "1");
}

const group = (page: Page) => page.locator(".utility-sticky-group");
const bar = (page: Page) => page.getByRole("navigation", { name: "Quick links" });
const hiddenFlag = (page: Page) => group(page).getAttribute("data-utility-hidden");
const scrollTo = (page: Page, y: number) => page.evaluate((top) => window.scrollTo(0, top), y);
const scrollBy = (page: Page, dy: number) => page.evaluate((d) => window.scrollBy(0, d), dy);
const docHeight = (page: Page) => page.evaluate(() => document.documentElement.scrollHeight);
const headerTop = async (page: Page) => (await page.locator("header").boundingBox())!.y;

for (const { width, height } of PHONE_SIZES) {
  test(`${width}px: the bar is pinned, hides on scroll down, returns the moment you scroll up, and never shifts the layout`, async ({ browser }) => {
    const page = await open(browser, width, height);
    await expect(bar(page)).toBeVisible();

    // Pinned unit: a sticky wrapper holding both the bar and the header row.
    expect(await group(page).evaluate((el) => getComputedStyle(el).position)).toBe("sticky");
    const initialBar = (await bar(page).boundingBox())!;
    expect(initialBar.y).toBe(0);
    expect(initialBar.height).toBeGreaterThanOrEqual(44);
    const barHeight = initialBar.height;
    expect(await headerTop(page)).toBeGreaterThanOrEqual(barHeight - 1); // the header row sits right under the bar
    const heightBefore = await docHeight(page);

    // Scroll down: the bar slides fully out of view and the header row takes its place at the very top.
    await scrollTo(page, 900);
    await expect.poll(() => hiddenFlag(page), { timeout: 3000 }).toBe("true");
    await expect.poll(async () => (await bar(page).boundingBox())!.y + (await bar(page).boundingBox())!.height, { timeout: 3000 }).toBeLessThanOrEqual(1);
    await expect.poll(() => headerTop(page), { timeout: 3000 }).toBeLessThanOrEqual(1);
    expect(await headerTop(page)).toBeGreaterThanOrEqual(-1);

    // No layout jump: the page is exactly as tall as before.
    expect(await docHeight(page)).toBe(heightBefore);

    // Keep scrolling down: it stays away (no flicker back).
    await scrollBy(page, 300);
    await page.waitForTimeout(350);
    expect(await hiddenFlag(page)).toBe("true");

    // The instant the visitor scrolls up, it is back — well inside one animation frame plus a short transition.
    await scrollBy(page, -40);
    await expect.poll(() => hiddenFlag(page), { timeout: 400 }).toBe("false");
    await expect.poll(async () => (await bar(page).boundingBox())!.y, { timeout: 1500 }).toBeGreaterThanOrEqual(-1);
    expect((await bar(page).boundingBox())!.y).toBeLessThanOrEqual(1);
    expect(await docHeight(page)).toBe(heightBefore);

    // Scrolling down again hides it again; at the very top it is always shown.
    await scrollBy(page, 500);
    await expect.poll(() => hiddenFlag(page), { timeout: 3000 }).toBe("true");
    await scrollTo(page, 0);
    await expect.poll(() => hiddenFlag(page), { timeout: 3000 }).toBe("false");
    await expect.poll(async () => (await bar(page).boundingBox())!.y, { timeout: 1500 }).toBeLessThanOrEqual(1);
    await expect.poll(() => headerTop(page), { timeout: 1500 }).toBeGreaterThanOrEqual(barHeight - 1); // header row back under the bar
    await page.context().close();
  });
}

test("every bar link still works, both at the top of the page and after scrolling up mid-page", async ({ browser }) => {
  const page = await open(browser, 390, 844);
  await bar(page).getByRole("link", { name: "News Calendar", exact: true }).click();
  await expect(page).toHaveURL(/\/calendar$/);

  // On a long page: scroll down (bar hides), scroll up (bar returns), then use it.
  await page.goto("/", { waitUntil: "load" });
  await waitReady(page);
  await scrollTo(page, 1200);
  await expect.poll(() => hiddenFlag(page), { timeout: 3000 }).toBe("true");
  await scrollBy(page, -60);
  await expect.poll(() => hiddenFlag(page), { timeout: 600 }).toBe("false");
  await page.waitForTimeout(350); // transition
  for (const [name, path] of [["Cart", /\/cart$/], ["Sign in", /\/auth\/sign-in$/], ["Sign up", /\/auth\/sign-up$/], ["Be Our Partner", /\/partnership$/]] as const) {
    await page.goto("/", { waitUntil: "load" });
    await waitReady(page);
    await bar(page).getByRole("link", { name, exact: true }).click();
    await expect(page, name).toHaveURL(path);
  }
  await page.context().close();
});

test("keyboard focus on a bar link, or opening the menu, brings a hidden bar back", async ({ browser }) => {
  const page = await open(browser, 390, 844);
  await scrollTo(page, 1200);
  await expect.poll(() => hiddenFlag(page), { timeout: 3000 }).toBe("true");
  await bar(page).getByRole("link", { name: "Cart", exact: true }).focus();
  await expect.poll(() => hiddenFlag(page), { timeout: 600 }).toBe("false");

  await (async () => {
    await scrollBy(page, 800);
    await expect.poll(() => hiddenFlag(page), { timeout: 3000 }).toBe("true");
    await page.getByRole("button", { name: "Toggle menu" }).click();
    await expect.poll(() => hiddenFlag(page), { timeout: 600 }).toBe("false"); // the menu is open: bar and header stay together
    await scrollBy(page, 400);
    await page.waitForTimeout(350);
    expect(await hiddenFlag(page)).toBe("false"); // and stays while the menu is open
  })();
  await page.context().close();
});

test("tablets and desktops are untouched: no wrapper box, no hiding, the header stays pinned as before", async ({ browser }) => {
  for (const [width, height] of [[768, 1024], [900, 900], [1280, 900], [1440, 900]] as const) {
    const page = await open(browser, width, height);
    expect(await group(page).evaluate((el) => getComputedStyle(el).display), `${width}px`).toBe("contents");
    await expect(bar(page)).toBeHidden();
    await scrollTo(page, 1200);
    await page.waitForTimeout(400);
    await scrollBy(page, -80);
    await page.waitForTimeout(300);
    expect(await hiddenFlag(page)).toBe("false");
    expect(await group(page).evaluate((el) => getComputedStyle(el).transform)).toBe("none");
    const header = page.locator("header");
    expect(await header.evaluate((el) => getComputedStyle(el).position)).toBe("sticky");
    expect((await header.boundingBox())!.y).toBeLessThanOrEqual(1); // still pinned at the top while scrolled
    await page.context().close();
  }
});

test("rotating or resizing to a wide screen while the bar is tucked away resets it", async ({ browser }) => {
  const page = await open(browser, 390, 844);
  await scrollTo(page, 1200);
  await expect.poll(() => hiddenFlag(page), { timeout: 3000 }).toBe("true");
  await page.setViewportSize({ width: 1024, height: 768 });
  await expect.poll(() => hiddenFlag(page), { timeout: 2000 }).toBe("false");
  expect(await group(page).evaluate((el) => getComputedStyle(el).display)).toBe("contents");
  await page.context().close();
});

test("with reduced motion the bar still hides and returns, without animating", async ({ browser }) => {
  const page = await open(browser, 390, 844, { reducedMotion: "reduce" });
  expect(await group(page).evaluate((el) => getComputedStyle(el).transitionDuration)).toMatch(/^0s$/);
  await scrollTo(page, 1200);
  await expect.poll(() => hiddenFlag(page), { timeout: 3000 }).toBe("true");
  await scrollBy(page, -50);
  await expect.poll(() => hiddenFlag(page), { timeout: 600 }).toBe("false");
  await page.context().close();
});
