import { test, expect, type Browser, type Page } from "@playwright/test";
import { PRIMARY_NAV } from "../src/config/navigation";
import { signIn, E2E_BUYER } from "./helpers";

// Smartphone navigation: the quick-links bar above the header and the expandable menu. Phones are < 768px;
// tablets and desktops must keep exactly the layout they had, so those widths are asserted here too.

const BASE = "http://localhost:3000";
const PHONE_WIDTHS = [320, 360, 375, 390, 430];

async function openPage(browser: Browser, width: number, height = 800): Promise<Page> {
  const context = await browser.newContext({ baseURL: BASE, viewport: { width, height } });
  return context.newPage();
}

const sideways = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
const toggle = (page: Page) => page.getByRole("button", { name: "Toggle menu" });

/** Elements inside the header (bar, logo row, open menu) that extend past the right edge of the screen. */
const headerOverflow = (page: Page) =>
  page.evaluate(() => {
    const vw = window.innerWidth;
    return [...document.querySelectorAll("header, header *")]
      .filter((el) => {
        const r = el.getBoundingClientRect();
        return r.width > 0 && r.right > vw + 0.5;
      })
      .map((el) => `${el.tagName.toLowerCase()}.${String(el.className).slice(0, 40)}`);
  });

test("the quick-links bar sits above the header on every phone width: five labelled targets, no overlap, no sideways scroll", async ({ browser }) => {
  for (const width of PHONE_WIDTHS) {
    const page = await openPage(browser, width);
    await page.goto("/");
    const bar = page.getByRole("navigation", { name: "Quick links" });
    await expect(bar, `${width}px`).toBeVisible();

    const expected = [
      { name: "News Calendar", text: "News", href: "/calendar" },
      { name: "Be Our Partner", text: "Partner", href: "/partnership" },
      { name: "Cart", text: "Cart", href: "/cart" },
      { name: "Sign in", text: "Sign In", href: "/auth/sign-in" },
      { name: "Sign up", text: "Sign Up", href: "/auth/sign-up" },
    ];
    const boxes: { left: number; right: number; height: number }[] = [];
    for (const item of expected) {
      const link = bar.getByRole("link", { name: item.name, exact: true });
      await expect(link, `${width}px ${item.name}`).toHaveAttribute("href", item.href);
      await expect(link).toContainText(item.text);
      await expect(link.locator("svg")).toHaveCount(1); // an icon beside the readable label
      const box = (await link.boundingBox())!;
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width, `${width}px ${item.name} stays on screen`).toBeLessThanOrEqual(width + 0.5);
      expect(box.height, `${width}px ${item.name} is a comfortable touch target`).toBeGreaterThanOrEqual(44);
      boxes.push({ left: box.x, right: box.x + box.width, height: box.height });
    }
    for (let i = 1; i < boxes.length; i++) expect(boxes[i].left, `${width}px items don't overlap`).toBeGreaterThanOrEqual(boxes[i - 1].right - 0.5);

    // Above the main header row (the logo).
    const barBox = (await bar.boundingBox())!;
    const logoBox = (await page.locator("header").getByRole("link", { name: /Bot\s*Hub/ }).first().boundingBox())!;
    expect(barBox.y + barBox.height).toBeLessThanOrEqual(logoBox.y + 0.5);

    expect(await headerOverflow(page), `${width}px: nothing in the header pokes off-screen`).toEqual([]);
    // (Some existing page content, e.g. the homepage hero button, is wider than a 320px screen; that is page content, not
    // navigation, so the whole-page check starts at 360px.)
    if (width >= 360) expect(await sideways(page), `${width}px sideways scroll`).toBe(0);
    await page.context().close();
  }
});

test("the bar's links all work", async ({ browser }) => {
  for (const [name, path] of [["News Calendar", /\/calendar$/], ["Be Our Partner", /\/partnership$/], ["Cart", /\/cart$/], ["Sign in", /\/auth\/sign-in$/], ["Sign up", /\/auth\/sign-up$/]] as const) {
    const page = await openPage(browser, 375, 812);
    await page.goto("/");
    await page.getByRole("navigation", { name: "Quick links" }).getByRole("link", { name, exact: true }).click();
    await expect(page, name).toHaveURL(path);
    // The current page is marked in the bar.
    await expect(page.getByRole("navigation", { name: "Quick links" }).getByRole("link", { name, exact: true })).toHaveAttribute("aria-current", "page");
    await page.context().close();
  }
});

test("tablets and desktops keep their layout: no quick-links bar, the original flat tablet menu, the original desktop bar", async ({ browser }) => {
  // Tablet (768-1279): hamburger menu with the original flat list — no accordions, no bar.
  const tablet = await openPage(browser, 768, 1024);
  await tablet.goto("/");
  await expect(tablet.getByRole("navigation", { name: "Quick links" })).toBeHidden();
  await toggle(tablet).click();
  await expect(tablet.locator("header").getByRole("link", { name: "MT4 EAs" })).toBeVisible(); // visible without expanding anything
  await expect(tablet.locator("header").getByRole("link", { name: "Market Analysis" })).toBeVisible();
  await expect(tablet.getByRole("navigation", { name: "Mobile menu" })).toBeHidden();
  await expect(tablet.getByRole("button", { name: "Insights", exact: true })).toBeHidden();
  expect(await sideways(tablet)).toBe(0);
  await tablet.context().close();

  // Desktop (1280+): the horizontal menu bar, no hamburger, no quick-links bar.
  const desktop = await openPage(browser, 1440, 900);
  await desktop.goto("/");
  await expect(desktop.getByRole("navigation", { name: "Quick links" })).toBeHidden();
  await expect(toggle(desktop)).toBeHidden();
  const labels = await desktop.getByRole("navigation", { name: "Primary" }).locator(":scope > div > button, :scope > a").allTextContents();
  expect(labels.map((l) => l.trim())).toEqual(["Marketplace", "Insights", "News Calendar", "Resources", "Best Brokers", "VPS", "Community"]);
  await desktop.context().close();
});

test("the phone menu groups Marketplace, Insights and Resources into expandable sections that open and close on tap", async ({ browser }) => {
  const page = await openPage(browser, 390, 844);
  await page.goto("/");
  await toggle(page).click();
  const menu = page.getByRole("navigation", { name: "Mobile menu" });
  await expect(menu).toBeVisible();

  for (const group of PRIMARY_NAV) {
    const button = menu.getByRole("button", { name: group.label, exact: true });
    const region = page.getByRole("region", { name: group.label, exact: true });
    // Collapsed to start: closed state exposed to assistive tech, links out of reach.
    await expect(button).toHaveAttribute("aria-expanded", "false");
    await expect(region).toBeHidden();
    await expect(button.locator("svg")).not.toHaveClass(/rotate-180/);
    expect((await button.boundingBox())!.height).toBeGreaterThanOrEqual(44);

    // Tap to expand: chevron rotates, every existing link is there with its original route.
    await button.click();
    await expect(button).toHaveAttribute("aria-expanded", "true");
    await expect(button.locator("svg")).toHaveClass(/rotate-180/);
    await expect(region).toBeVisible();
    await expect(region.getByRole("link")).toHaveCount(group.links.length);
    for (const link of group.links) {
      const anchor = region.getByRole("link", { name: link.label, exact: true });
      await expect(anchor, `${group.label} → ${link.label}`).toBeVisible();
      await expect(anchor).toHaveAttribute("href", link.href);
      expect((await anchor.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    }
    expect(await sideways(page)).toBe(0);

    // Tap again to collapse.
    await button.click();
    await expect(button).toHaveAttribute("aria-expanded", "false");
    await expect(button.locator("svg")).not.toHaveClass(/rotate-180/);
    await expect(region).toBeHidden();
  }
  await page.context().close();
});

test("opening one section closes the previous one, and the menu works from the keyboard", async ({ browser }) => {
  const page = await openPage(browser, 390, 844);
  await page.goto("/");
  await toggle(page).click();
  const menu = page.getByRole("navigation", { name: "Mobile menu" });
  const marketplace = menu.getByRole("button", { name: "Marketplace", exact: true });
  const insights = menu.getByRole("button", { name: "Insights", exact: true });

  await marketplace.click();
  await expect(marketplace).toHaveAttribute("aria-expanded", "true");
  await insights.click();
  await expect(insights).toHaveAttribute("aria-expanded", "true");
  await expect(marketplace).toHaveAttribute("aria-expanded", "false");
  await expect(page.locator("header").getByRole("link", { name: "MT4 EAs" })).toBeHidden();

  // Keyboard: focus the Resources button and press Enter / Space.
  const resources = menu.getByRole("button", { name: "Resources", exact: true });
  await resources.focus();
  await page.keyboard.press("Enter");
  await expect(resources).toHaveAttribute("aria-expanded", "true");
  await page.keyboard.press("Space");
  await expect(resources).toHaveAttribute("aria-expanded", "false");

  // Collapsed links are not reachable by Tab (they'd be invisible focus stops otherwise).
  const reachable = await page.evaluate(() => {
    const panel = document.querySelector('[role="region"][aria-labelledby]');
    return panel ? getComputedStyle(panel).visibility : "none";
  });
  expect(reachable).toBe("hidden");
  await page.context().close();
});

test("tapping a link goes to the right page, closes the menu, and the current page is marked", async ({ browser }) => {
  const page = await openPage(browser, 390, 844);
  await page.goto("/");
  await toggle(page).click();
  const menu = page.getByRole("navigation", { name: "Mobile menu" });

  await menu.getByRole("button", { name: "Insights", exact: true }).click();
  await page.getByRole("region", { name: "Insights", exact: true }).getByRole("link", { name: "Forex Signals", exact: true }).click();
  await expect(page).toHaveURL(/\/signals$/);
  await expect(menu).toBeHidden(); // the menu closed itself
  await expect(toggle(page)).toHaveAttribute("aria-expanded", "false");

  // Reopen: the section that contains the current page is marked, and so is the link.
  await toggle(page).click();
  await menu.getByRole("button", { name: "Insights", exact: true }).click();
  await expect(page.getByRole("region", { name: "Insights", exact: true }).getByRole("link", { name: "Forex Signals", exact: true })).toHaveAttribute("aria-current", "page");
  await expect(page.getByRole("region", { name: "Insights", exact: true }).getByRole("link", { name: "Dashboard", exact: true })).not.toHaveAttribute("aria-current", "page");

  // Stand-alone links (no section) work and close the menu too.
  for (const [label, path] of [["Best Brokers", /\/best-brokers$/], ["VPS", /\/vps$/], ["Community", /\/community$/]] as const) {
    if (!(await menu.isVisible())) await toggle(page).click();
    await menu.getByRole("link", { name: label, exact: true }).click();
    await expect(page, label).toHaveURL(path);
    await expect(menu).toBeHidden();
  }
  await page.context().close();
});

test("the phone menu keeps the News Calendar link in place, and search still works", async ({ browser }) => {
  const page = await openPage(browser, 375, 812);
  await page.goto("/");
  await toggle(page).click();
  const menu = page.getByRole("navigation", { name: "Mobile menu" });
  await menu.getByRole("link", { name: "News Calendar", exact: true }).click();
  await expect(page).toHaveURL(/\/calendar$/);

  await toggle(page).click();
  await menu.getByRole("searchbox", { name: "Search marketplace" }).fill("scalper");
  await menu.getByRole("searchbox", { name: "Search marketplace" }).press("Enter");
  await expect(page).toHaveURL(/\/marketplace\?q=scalper$/);
  await page.context().close();
});

test("no sideways scroll or clipping with the menu fully open on the narrowest phones, and it scrolls inside a short screen", async ({ browser }) => {
  for (const [width, height] of [[320, 568], [360, 640]] as const) {
    const page = await openPage(browser, width, height);
    await page.goto("/");
    await toggle(page).click();
    const menu = page.getByRole("navigation", { name: "Mobile menu" });
    await menu.getByRole("button", { name: "Marketplace", exact: true }).click();
    await expect(page.locator("header").getByRole("link", { name: "Featured Products" })).toBeVisible();
    expect(await headerOverflow(page), `${width}px: nothing in the open menu pokes off-screen`).toEqual([]);
    // The panel is capped to the screen and scrolls itself, so its last items remain reachable.
    const metrics = await menu.evaluate((el) => ({ client: el.clientHeight, scroll: el.scrollHeight, viewport: window.innerHeight }));
    expect(metrics.client).toBeLessThanOrEqual(metrics.viewport);
    await menu.getByRole("link", { name: "Community", exact: true }).scrollIntoViewIfNeeded();
    await expect(menu.getByRole("link", { name: "Community", exact: true })).toBeInViewport();
    await page.context().close();
  }
});

test("signed in, the bar shows Account and Partnership instead of Sign in / Sign up", async ({ browser }) => {
  const page = await openPage(browser, 375, 812);
  await signIn(page, E2E_BUYER);
  await page.goto("/");
  const bar = page.getByRole("navigation", { name: "Quick links" });
  await expect(bar.getByRole("link", { name: "Account", exact: true })).toHaveAttribute("href", "/dashboard");
  await expect(bar.getByRole("link", { name: "Partnership", exact: true })).toHaveAttribute("href", "/dashboard/partnership");
  await expect(bar.getByRole("link", { name: "Sign in", exact: true })).toHaveCount(0);
  await expect(bar.getByRole("link", { name: "Sign up", exact: true })).toHaveCount(0);
  await expect(bar.getByRole("link", { name: "Cart", exact: true })).toHaveAttribute("href", "/cart");
  expect(await sideways(page)).toBe(0);
  await page.context().close();
});
