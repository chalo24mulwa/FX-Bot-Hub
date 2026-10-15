import { test, expect, type Browser, type Page } from "@playwright/test";
import { signIn, E2E_ADMIN, E2E_BUYER } from "./helpers";

// Partnership programme, end to end through the real UI: apply -> admin
// approval -> referral link -> referred sign-up -> verified purchase -> 20%
// commission -> Master Partner -> recruitment -> 10% override -> refund
// reversal, plus the access rules. Every member is freshly registered per run.
// Relies on PARTNERSHIP_ALLOW_MANUAL_PAYMENT_COMMISSIONS=true (playwright.config.ts).

test.describe.configure({ mode: "serial" });
// Each test drives several members through real sign-ups and checkouts.
test.setTimeout(90_000);

async function register(page: Page, email: string, name: string) {
  await page.goto("/auth/sign-up");
  await page.getByLabel("Name").fill(name);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill("password123");
  await page.getByRole("button", { name: "Sign up" }).click();
  await page.waitForURL(/\/auth\/sign-in$/);
  await signIn(page, email);
}

// Each simulated member gets their own client address, so the suite's many
// sign-ups don't share one IP-keyed registration rate-limit bucket.
const randomIp = () => `10.${1 + Math.floor(Math.random() * 250)}.${1 + Math.floor(Math.random() * 250)}.${1 + Math.floor(Math.random() * 250)}`;

async function freshPage(browser: Browser) {
  const context = await browser.newContext({ extraHTTPHeaders: { "x-forwarded-for": randomIp() } });
  return context.newPage();
}

/** Opens a link carrying ?ref= or ?master= and waits for the server to validate it. */
async function followLink(page: Page, url: string) {
  const tracked = page.waitForResponse((r) => r.url().endsWith("/api/partnership/track") && r.request().method() === "POST");
  await page.goto(url);
  const res = await tracked;
  return (await res.json()) as { tracked: boolean };
}

async function adminDecide(admin: Page, email: string, button: string, reason?: string) {
  await admin.goto(`/admin/partnership?q=${encodeURIComponent(email)}`);
  await admin.getByRole("row", { name: new RegExp(email) }).getByRole("link", { name: "Review" }).click();
  await admin.getByRole("button", { name: button, exact: true }).click();
  if (reason) {
    await admin.getByPlaceholder(/Reason/).fill(reason);
    await admin.getByRole("button", { name: `Confirm ${button.toLowerCase()}` }).click();
  }
}

async function buyPartnerProduct(page: Page) {
  await page.goto("/marketplace/e2e-partner-product");
  await page.getByRole("button", { name: /Buy — \$49\.00/ }).click();
  await expect(page).toHaveURL(/\/cart$/);
  await page.getByRole("button", { name: "Checkout" }).click();
  await expect(page).toHaveURL(/\/dashboard\/orders\//, { timeout: 15_000 });
  await expect(page.getByText("PAID")).toBeVisible();
  return page.url();
}

const run = Date.now();
const partnerEmail = `e2e-partner-${run}@fxbotmarket.local`;
const buyerEmail = `e2e-referred-${run}@fxbotmarket.local`;
const recruitEmail = `e2e-recruit-${run}@fxbotmarket.local`;
const buyer2Email = `e2e-referred2-${run}@fxbotmarket.local`;
let partnerPage: Page;
let adminPage: Page;
let referralCode = "";
let orderUrl = "";

test("a member applies and an admin approves them as a Partner", async ({ browser }) => {
  partnerPage = await freshPage(browser);
  await register(partnerPage, partnerEmail, "E2E Partner");
  await partnerPage.goto("/dashboard/partnership");
  await expect(partnerPage.getByRole("heading", { name: "Partnership Programme" })).toBeVisible();
  const apply = partnerPage.getByRole("button", { name: "Become a Partner" });
  await expect(apply).toBeDisabled(); // terms must be accepted first
  await partnerPage.getByLabel(/How will you share FXBotHub/).fill("E2E test channel");
  await partnerPage.getByRole("checkbox").check();
  await apply.click();
  // The page refreshes into the "pending review" state.
  await expect(partnerPage.getByText("Application received")).toBeVisible();
  await partnerPage.reload();
  await expect(partnerPage.getByText("Application received")).toBeVisible();

  adminPage = await freshPage(browser);
  await signIn(adminPage, E2E_ADMIN);
  await adminDecide(adminPage, partnerEmail, "Approve");
  await expect(adminPage.getByRole("heading", { name: "Partner", exact: true }).locator("..").getByText("Approved")).toBeVisible();

  await partnerPage.goto("/dashboard/partnership");
  const link = partnerPage.getByRole("textbox", { name: "Your referral link" });
  await expect(link).toBeVisible();
  const value = await link.inputValue();
  referralCode = new URL(value).searchParams.get("ref") ?? "";
  expect(referralCode).toMatch(/^[A-Z0-9]{8}$/);
});

test("a Partner's own link is never tracked", async () => {
  expect((await followLink(partnerPage, `/?ref=${referralCode}`)).tracked).toBe(false);
  expect((await followLink(partnerPage, `/?ref=NOTACODE`)).tracked).toBe(false);
});

test("a visitor from the referral link signs up, buys, and the Partner earns a pending 20% commission", async ({ browser }) => {
  const buyer = await freshPage(browser);
  expect((await followLink(buyer, `/marketplace/e2e-partner-product?ref=${referralCode}`)).tracked).toBe(true);
  await expect(buyer).toHaveURL(/\/marketplace\/e2e-partner-product$/); // ?ref= removed from the address bar
  await register(buyer, buyerEmail, "E2E Referred Buyer");
  orderUrl = await buyPartnerProduct(buyer);

  await partnerPage.goto("/dashboard/partnership");
  const card = (label: string) => partnerPage.getByText(label, { exact: true }).locator("..");
  await expect(card("Registered referred users")).toContainText("1");
  await expect(card("Referred users who purchased")).toContainText("1");
  await expect(card("Total eligible sales")).toContainText("$49.00");
  await expect(card("Pending commission")).toContainText("$9.80");

  await partnerPage.goto("/dashboard/partnership/commissions");
  const row = partnerPage.getByRole("row", { name: /E2E Partner Product/ });
  await expect(row).toContainText("$49.00 × 20%");
  await expect(row).toContainText("$9.80");
  await expect(row).toContainText("Pending");

  await partnerPage.goto("/dashboard/partnership/referrals");
  await expect(partnerPage.getByRole("row", { name: /E2E Referred Buyer/ })).toContainText("Purchased");
  await expect(partnerPage.getByText(buyerEmail)).toHaveCount(0); // never shows email addresses

  await partnerPage.goto("/dashboard/partnership/payouts");
  await expect(partnerPage.getByText(/You can request a payout when your approved balance/)).toBeVisible();
});

test("Master Partner: apply, approval, recruitment link, and a 10% override on a recruit's sale", async ({ browser }) => {
  await partnerPage.goto("/dashboard/partnership/master");
  await partnerPage.getByLabel("How will you recruit and support Partners?").fill("I run an E2E trading community and will onboard Partners.");
  await partnerPage.getByRole("checkbox").check();
  await partnerPage.getByRole("button", { name: "Apply to become a Master Partner" }).click();
  await expect(partnerPage.getByText(/We.ll let you know when it.s been reviewed/)).toBeVisible();

  await adminDecide(adminPage, partnerEmail, "Approve Master Partner");
  await expect(adminPage.getByRole("heading", { name: "Master Partner", exact: true }).locator("..").getByText("Approved")).toBeVisible();

  await partnerPage.goto("/dashboard/partnership/master");
  const recruitLink = await partnerPage.getByRole("textbox", { name: "Your recruitment link" }).inputValue();
  expect(recruitLink).toMatch(/\/partnership\/join\?master=[A-Z0-9]{8}$/);

  const recruit = await freshPage(browser);
  const path = new URL(recruitLink).pathname + new URL(recruitLink).search;
  expect((await followLink(recruit, path)).tracked).toBe(true);
  await expect(recruit.getByText(/invited you to become a Partner/)).toBeVisible();
  await register(recruit, recruitEmail, "E2E Recruit");
  await recruit.goto("/dashboard/partnership");
  await recruit.getByRole("checkbox").check();
  await recruit.getByRole("button", { name: "Become a Partner" }).click();
  await expect(recruit.getByText("Application received")).toBeVisible();

  await adminDecide(adminPage, recruitEmail, "Approve");
  // Wait for the decision to commit before the recruit loads their dashboard (it races under load otherwise).
  await expect(adminPage.getByRole("heading", { name: "Partner", exact: true }).locator("..").getByText("Approved")).toBeVisible();
  await expect(adminPage.getByText("Recruited by").locator("..")).toContainText("E2E Partner");

  await recruit.goto("/dashboard/partnership");
  const recruitCode = new URL(await recruit.getByRole("textbox", { name: "Your referral link" }).inputValue()).searchParams.get("ref");

  const buyer2 = await freshPage(browser);
  expect((await followLink(buyer2, `/?ref=${recruitCode}`)).tracked).toBe(true);
  await register(buyer2, buyer2Email, "E2E Referred Buyer Two");
  await buyPartnerProduct(buyer2);

  await partnerPage.goto("/dashboard/partnership/commissions?type=MASTER_PARTNER");
  const masterRow = partnerPage.getByRole("row", { name: /E2E Partner Product/ });
  await expect(masterRow).toContainText("$49.00 × 10%");
  await expect(masterRow).toContainText("$4.90");
  await partnerPage.goto("/dashboard/partnership/master");
  await expect(partnerPage.getByRole("row", { name: /E2E Recruit/ })).toContainText("$4.90");

  await recruit.goto("/dashboard/partnership/commissions");
  await expect(recruit.getByRole("row", { name: /E2E Partner Product/ })).toContainText("$9.80"); // not reduced by the override
});

test("a refund reverses the commission", async ({ browser }) => {
  const buyer = await freshPage(browser);
  await signIn(buyer, buyerEmail);
  await buyer.goto(orderUrl);
  await buyer.getByRole("button", { name: "Request refund" }).click();
  await buyer.getByRole("textbox").fill("E2E partnership refund");
  await buyer.getByRole("button", { name: "Submit request" }).click();
  await expect(buyer.getByText("Refund requested")).toBeVisible({ timeout: 10_000 });

  await adminPage.goto("/admin/refunds");
  const row = adminPage.getByRole("row", { name: new RegExp(buyerEmail) });
  adminPage.once("dialog", (dialog) => dialog.accept());
  await row.getByRole("button", { name: "Approve" }).click();
  await expect(row.getByText("PROCESSED")).toBeVisible({ timeout: 10_000 });

  await partnerPage.goto("/dashboard/partnership/commissions?type=PARTNER");
  const reversed = partnerPage.getByRole("row", { name: /E2E Partner Product/ });
  await expect(reversed).toContainText("Reversed");
  await expect(reversed).toContainText("Order refunded");
});

test("access rules: members can't reach admin pages or Partner tabs they don't have", async ({ browser }) => {
  const member = await freshPage(browser);
  await signIn(member, E2E_BUYER);
  await member.goto("/admin/partnership");
  await expect(member).toHaveURL(/\/auth\/sign-in/);
  await member.goto("/dashboard/partnership/commissions");
  await expect(member).toHaveURL(/\/dashboard\/partnership$/);

  const anon = await freshPage(browser);
  await anon.goto("/dashboard/partnership");
  await expect(anon).toHaveURL(/\/auth\/sign-in/);
  await anon.goto("/partnership");
  await expect(anon.getByRole("heading", { name: "FXBotHub Partnership Programme" })).toBeVisible();
  await anon.goto("/partnership/terms");
  await expect(anon.getByRole("heading", { name: "Master Partners" })).toBeVisible();
  await expect(anon.getByText("{{")).toHaveCount(0);
});
