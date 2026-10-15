import { test, expect, type Browser, type Page } from "@playwright/test";
import { signIn, E2E_ADMIN } from "./helpers";

// "Be Our Partner" calls to action: present where intended, every link valid,
// clicks counted, sign-up returns the visitor to the application, and each
// placement reflects the member's real Partnership status.

test.describe.configure({ mode: "serial" });
test.setTimeout(90_000);

const randomIp = () => `10.${1 + Math.floor(Math.random() * 250)}.${1 + Math.floor(Math.random() * 250)}.${1 + Math.floor(Math.random() * 250)}`;
async function freshPage(browser: Browser, viewport = { width: 1366, height: 900 }) {
  const context = await browser.newContext({ viewport, extraHTTPHeaders: { "x-forwarded-for": randomIp() } });
  return context.newPage();
}

const email = `e2e-cta-${Date.now()}@fxbotmarket.local`;
let member: Page;

test("visitors see the invitation in the header, homepage, footer and content pages — and every link works", async ({ browser }) => {
  const page = await freshPage(browser);
  await page.goto("/");
  await expect(page.locator("header").getByRole("link", { name: "Be Our Partner" })).toHaveAttribute("href", "/partnership");
  const section = page.getByRole("region", { name: "Earn with FXBotHub" });
  await expect(section).toContainText("20%");
  await expect(section).toContainText("No guaranteed earnings");
  await expect(page.locator("footer").getByRole("link", { name: "Become a Partner" })).toHaveAttribute("href", "/partnership");

  // Clicks are counted (placement only), and the link lands on the real page.
  const counted = page.waitForResponse((r) => r.url().endsWith("/api/partnership/cta") && r.status() === 204);
  await section.getByRole("link", { name: "Be Our Partner" }).click();
  await counted;
  await expect(page).toHaveURL(/\/partnership$/);
  await expect(page.getByRole("heading", { name: "FXBotHub Partnership Programme" })).toBeVisible();

  for (const [path, name] of [
    ["/marketplace", "become an FXBotHub Partner"],
    ["/marketplace/e2e-free-product", "Learn about the FXBotHub Partner Programme"],
    ["/guides", "Join the FXBotHub Partner Programme"],
    ["/tutorials", "Earn with the FXBotHub Partner Programme"],
    ["/developer-resources", "Become an FXBotHub Partner"],
  ] as const) {
    await page.goto(path);
    await expect(page.getByRole("link", { name, exact: true }), path).toHaveAttribute("href", "/partnership");
  }
  const res = await page.request.get("/partnership/terms");
  expect(res.status()).toBe(200);
});

test("the mobile menu has the link and nothing scrolls sideways", async ({ browser }) => {
  const page = await freshPage(browser, { width: 375, height: 812 });
  await page.goto("/");
  await page.getByRole("button", { name: "Toggle menu" }).click();
  await expect(page.locator("header").getByRole("link", { name: "Be Our Partner" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBe(0);
});

test("signing up from the programme page returns the new member to the application", async ({ browser }) => {
  member = await freshPage(browser);
  await member.goto("/partnership");
  await member.getByRole("link", { name: "Create a free account to apply" }).click();
  await expect(member).toHaveURL(/\/auth\/sign-up\?callbackUrl=%2Fdashboard%2Fpartnership$/);
  await member.getByLabel("Name").fill("E2E CTA Member");
  await member.getByLabel("Email").fill(email);
  await member.getByLabel("Password", { exact: true }).fill("password123");
  await member.getByRole("button", { name: "Sign up" }).click();
  await expect(member).toHaveURL(/\/auth\/sign-in\?callbackUrl=/);
  await member.getByLabel("Email").fill(email);
  await member.getByLabel("Password", { exact: true }).fill("password123");
  await member.getByRole("button", { name: "Sign in" }).click();
  await expect(member).toHaveURL(/\/dashboard\/partnership$/);
  await expect(member.getByRole("heading", { name: "Partnership Programme" })).toBeVisible();
});

test("an external callbackUrl is ignored (no open redirect)", async ({ browser }) => {
  const page = await freshPage(browser);
  await page.goto("/auth/sign-in?callbackUrl=//evil.example/steal");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill("password123");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/localhost:3000\/marketplace$/);
});

test("placements follow the member's real status: not joined → pending → approved → suspended", async ({ browser }) => {
  const dashboardCard = () => member.getByRole("complementary", { name: "FXBotHub Partnership" });

  await member.goto("/dashboard");
  await expect(dashboardCard().getByRole("link", { name: "Be Our Partner" })).toHaveAttribute("href", "/dashboard/partnership");
  await expect(member.locator("header").getByRole("link", { name: "Partnership" })).toHaveAttribute("href", "/dashboard/partnership");

  await member.goto("/dashboard/partnership");
  await member.getByRole("checkbox").check();
  await member.getByRole("button", { name: "Become a Partner" }).click();
  await expect(member.getByText("Application received")).toBeVisible();

  await member.goto("/dashboard");
  await expect(dashboardCard().getByRole("link", { name: "View Partnership application" })).toBeVisible();
  await expect(dashboardCard().getByRole("link", { name: "Be Our Partner" })).toHaveCount(0);
  await member.goto("/");
  await expect(member.getByRole("region", { name: "Partnership" }).getByRole("link", { name: "View Partnership application" })).toBeVisible();

  const admin = await freshPage(browser);
  await signIn(admin, E2E_ADMIN);
  const open = async () => {
    await admin.goto(`/admin/partnership?q=${encodeURIComponent(email)}`);
    await admin.getByRole("row", { name: new RegExp(email) }).getByRole("link", { name: "Review" }).click();
  };
  await open();
  await admin.getByRole("button", { name: "Approve", exact: true }).click();
  await expect(admin.getByRole("button", { name: "Suspend", exact: true })).toBeVisible();

  await member.goto("/dashboard");
  await expect(dashboardCard().getByRole("link", { name: "Partnership dashboard" })).toBeVisible();
  await expect(dashboardCard().getByRole("link", { name: "Referral links" })).toHaveAttribute("href", "/dashboard/partnership/links");
  await member.goto("/");
  await expect(member.getByRole("region", { name: "Your Partnership" }).getByRole("link", { name: "Partnership dashboard" })).toBeVisible();

  await open();
  await admin.getByRole("button", { name: "Suspend", exact: true }).click();
  await admin.getByPlaceholder(/Reason/).fill("E2E suspension");
  await admin.getByRole("button", { name: "Confirm suspend" }).click();
  await expect(admin.getByRole("button", { name: "Reactivate", exact: true })).toBeVisible();

  await member.goto("/dashboard");
  await expect(dashboardCard().getByRole("link", { name: "View Partnership status" })).toBeVisible();
  await expect(dashboardCard().getByRole("link", { name: /Be Our Partner|Referral links/ })).toHaveCount(0);

  await admin.goto("/admin/partnership");
  await expect(admin.getByText(/Be Our Partner.{1,3}clicks, last 30 days/)).toBeVisible();
});
