import { test, expect, type Browser, type Page } from "@playwright/test";
import { signIn, E2E_ADMIN } from "./helpers";

// Community end-to-end: posting, threading, votes, reports, moderation and the
// three restriction levels. The moderated members are freshly registered per run
// (never the shared e2e-buyer/seller), so a ban here can't leak into other specs.
// Image upload isn't exercised — CI has no S3/MinIO (same as product-lifecycle).

test.describe.configure({ mode: "serial" });

const suffix = Date.now();
const authorEmail = `e2e-community-author-${suffix}@fxbotmarket.local`;
const readerEmail = `e2e-community-reader-${suffix}@fxbotmarket.local`;
const discussionTitle = `NFP risk sizing ${suffix}`;
const ideaTitle = `EUR/USD retest ${suffix}`;

async function newSignedInPage(browser: Browser, email: string, name: string, viewport?: { width: number; height: number }) {
  const context = await browser.newContext({ viewport: viewport ?? { width: 1280, height: 800 }, baseURL: "http://localhost:3000" });
  const page = await context.newPage();
  await page.goto("/auth/sign-up");
  await page.getByLabel("Name").fill(name);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill("password123");
  await page.getByRole("button", { name: "Sign up" }).click();
  await expect(page).toHaveURL(/\/auth\/sign-in$/);
  await signIn(page, email);
  return page;
}

async function adminPage(browser: Browser) {
  const context = await browser.newContext({ baseURL: "http://localhost:3000" });
  const page = await context.newPage();
  await signIn(page, E2E_ADMIN);
  return page;
}

async function restrictMember(admin: Page, email: string, kind: "Suspend posting" | "Ban permanently", button: string) {
  await admin.goto(`/admin/community/members?q=${encodeURIComponent(email)}`);
  await admin.getByText("Restrict this member…").click();
  await admin.locator("select").first().selectOption({ label: kind === "Suspend posting" ? "Suspend posting (can still read & like)" : "Ban permanently" });
  await admin.locator("form textarea").fill("Breaking the community rules (e2e)");
  await admin.getByRole("button", { name: button }).click();
  await expect(admin.getByText("Restriction applied.")).toBeVisible({ timeout: 15_000 });
}

let authorPage: Page;
let postUrl = "";

test("a member can start a discussion and it shows up in the feed, search and sorting", async ({ browser }) => {
  authorPage = await newSignedInPage(browser, authorEmail, "Community Author");

  await authorPage.goto("/community/new");
  await expect(authorPage.getByRole("heading", { name: "Create a post" })).toBeVisible();
  // A discussion must not demand trade parameters.
  await expect(authorPage.locator("#post-entry")).toHaveCount(0);

  await authorPage.locator("#post-title").fill(discussionTitle);
  await authorPage.locator("#post-content").fill("I halve my size around **NFP**.\n\n- widen stops\n- skip the first minute");
  await authorPage.locator("#post-instrument").fill("eurusd");
  await authorPage.locator("#post-tags").fill("risk, nfp");
  await authorPage.getByRole("button", { name: "Publish post" }).click();

  await authorPage.waitForURL(/\/community\/post\/[\w-]+$/, { timeout: 20_000 });
  postUrl = new URL(authorPage.url()).pathname;
  await expect(authorPage.getByRole("heading", { name: discussionTitle })).toBeVisible();
  await expect(authorPage.getByText("widen stops")).toBeVisible();
  await expect(authorPage.getByText("EUR/USD").first()).toBeVisible();
  await expect(authorPage.getByText(/do not constitute financial advice/i).first()).toBeVisible();

  await authorPage.goto("/community");
  await expect(authorPage.getByRole("link", { name: discussionTitle }).first()).toBeVisible();
  await authorPage.goto("/community?sort=trending");
  await expect(authorPage.getByRole("link", { name: discussionTitle }).first()).toBeVisible();
  await authorPage.goto(`/community/search?q=${encodeURIComponent("NFP risk sizing")}`);
  await expect(authorPage.getByRole("link", { name: discussionTitle }).first()).toBeVisible();
});

test("comments and threaded replies work, and own content can be edited or deleted", async () => {
  await authorPage.goto(postUrl);
  await authorPage.getByPlaceholder("Add to the discussion…").fill("First comment from the author.");
  await authorPage.getByRole("button", { name: "Post comment" }).click();
  await expect(authorPage.getByText("First comment from the author.")).toBeVisible({ timeout: 15_000 });

  await authorPage.getByRole("button", { name: "Reply", exact: true }).first().click();
  await authorPage.getByPlaceholder(/^Reply to/).fill("A nested reply.");
  await authorPage.getByRole("button", { name: "Reply", exact: true }).last().click();
  await expect(authorPage.getByText("A nested reply.")).toBeVisible({ timeout: 15_000 });
  await expect(authorPage.getByRole("heading", { name: "2 comments" })).toBeVisible();

  // Edit own comment.
  await authorPage.getByRole("button", { name: "Edit", exact: true }).first().click();
  await authorPage.getByLabel("Edit comment").fill("First comment, edited.");
  await authorPage.getByRole("button", { name: "Save", exact: true }).click();
  await expect(authorPage.getByText("First comment, edited.")).toBeVisible({ timeout: 15_000 });

  // Delete own reply (native confirm dialog).
  authorPage.once("dialog", (d) => void d.accept());
  await authorPage.getByRole("button", { name: "Delete", exact: true }).last().click();
  await expect(authorPage.getByText("A nested reply.")).toHaveCount(0, { timeout: 15_000 });
});

test("a trading idea shows its setup, works out the risk/reward, and rejects an impossible one", async () => {
  await authorPage.goto("/community/new");
  await authorPage.locator("label", { hasText: "Trading Idea" }).click();
  await authorPage.locator("#post-title").fill(ideaTitle);
  await authorPage.locator("#post-content").fill("Retesting broken trendline as support.");
  await authorPage.locator("#post-instrument").fill("EURUSD");
  await authorPage.getByRole("button", { name: "BUY", exact: true }).click();
  await authorPage.locator("#post-timeframe").selectOption("H4");

  // BUY with the stop above entry is impossible — the server refuses it.
  await authorPage.locator("#post-entry").fill("1.0860");
  await authorPage.locator("#post-sl").fill("1.0900");
  await authorPage.locator("#post-tp").fill("1.0950");
  await authorPage.getByRole("button", { name: "Publish post" }).click();
  await expect(authorPage.getByRole("alert").first()).toBeVisible({ timeout: 15_000 });
  await expect(authorPage).toHaveURL(/\/community\/new/);

  await authorPage.locator("#post-sl").fill("1.0820");
  await authorPage.getByRole("button", { name: "Publish post" }).click();
  await authorPage.waitForURL(/\/community\/post\/[\w-]+$/, { timeout: 20_000 });
  await expect(authorPage.getByRole("heading", { name: ideaTitle })).toBeVisible();
  await expect(authorPage.getByText("1.0860")).toBeVisible();
  await expect(authorPage.getByText("1 : 2.25")).toBeVisible();
  await expect(authorPage.getByText(/not advice/i).first()).toBeVisible();
});

test("another member can like, save and report a post; anonymous visitors can read but not act", async ({ browser, request }) => {
  const reader = await newSignedInPage(browser, readerEmail, "Community Reader");
  await reader.goto(postUrl);

  // Like/save flip optimistically, so wait for the server action itself (a POST to
  // the page) before navigating away — leaving early would cancel it under load.
  const serverAction = () => reader.waitForResponse((r) => r.request().method() === "POST" && r.url().includes("/community/post/"));
  let done = serverAction();
  await reader.getByRole("button", { name: "Like this post" }).click();
  await expect(reader.getByRole("button", { name: "Remove like" })).toBeVisible({ timeout: 15_000 });
  await done;
  done = serverAction();
  await reader.getByRole("button", { name: "Save this post" }).click();
  await expect(reader.getByRole("button", { name: "Remove from saved" })).toBeVisible({ timeout: 15_000 });
  await done;
  await reader.goto("/community/saved");
  await expect(reader.getByRole("link", { name: discussionTitle }).first()).toBeVisible();

  await reader.goto(postUrl);
  await reader.getByRole("article").getByRole("button", { name: "Report", exact: true }).click();
  await reader.getByLabel("Fake signal / performance claim").check();
  await reader.getByRole("button", { name: "Submit report" }).click();
  await expect(reader.getByRole("dialog")).toBeHidden({ timeout: 15_000 });
  await reader.context().close();

  // Anonymous: readable, but no comment box.
  const anon = await request.get(postUrl);
  expect(anon.status()).toBe(200);
  const anonPresign = await request.post("/api/community/uploads/presign", {
    headers: { Origin: "http://localhost:3000" },
    data: { filename: "a.png", contentType: "image/png", size: 100 },
  });
  expect(anonPresign.status()).toBe(401);
  const crossOrigin = await request.post("/api/community/uploads/presign", {
    headers: { Origin: "http://evil.example" },
    data: { filename: "a.png", contentType: "image/png", size: 100 },
  });
  expect(crossOrigin.status()).toBe(403);
});

test("a moderator sees the report, can hide and restore the post, and hidden posts are not public", async ({ browser, request }) => {
  const admin = await adminPage(browser);
  await admin.goto("/admin/community/reports");
  await expect(admin.getByText(discussionTitle)).toBeVisible();
  await expect(admin.getByText(/Fake signal/i).first()).toBeVisible();

  await admin.goto(`/admin/community/posts?q=${encodeURIComponent(discussionTitle)}`);
  await admin.getByRole("button", { name: "Hide", exact: true }).click();
  await admin.getByPlaceholder(/Reason/).fill("Held while the report is reviewed");
  await admin.getByRole("button", { name: "Hide post" }).click();
  await expect(admin.getByRole("button", { name: "Restore" })).toBeVisible({ timeout: 15_000 });

  expect((await request.get(postUrl)).status()).toBe(404);

  await admin.getByRole("button", { name: "Restore" }).click();
  await expect(admin.getByRole("button", { name: "Hide", exact: true })).toBeVisible({ timeout: 15_000 });
  expect((await request.get(postUrl)).status()).toBe(200);

  // Pin / feature / lock are reflected on the post.
  for (const action of ["Pin", "Feature", "Lock"]) {
    await admin.getByRole("button", { name: action, exact: true }).click();
    await expect(admin.getByRole("button", { name: `Un${action.toLowerCase()}` })).toBeVisible({ timeout: 15_000 });
  }
  await authorPage.goto(postUrl);
  await expect(authorPage.getByText(/This discussion is locked/i)).toBeVisible();
  await admin.context().close();
});

test("a posting suspension blocks posting with a clear message, then a ban, without touching the FX Bot Hub account", async ({ browser }) => {
  const admin = await adminPage(browser);

  await restrictMember(admin, authorEmail, "Suspend posting", "Apply restriction");
  await authorPage.goto("/community/new");
  await expect(authorPage.getByText(/posting privileges in the Community are suspended/i).first()).toBeVisible();
  await expect(authorPage.getByText(/Breaking the community rules/).first()).toBeVisible();
  await expect(authorPage.locator("#post-title")).toHaveCount(0);

  await restrictMember(admin, authorEmail, "Ban permanently", "Ban from Community");
  await authorPage.goto("/community/new");
  await expect(authorPage.getByText(/permanently banned from posting in the Community/i).first()).toBeVisible();

  // The Community ban is not an account ban: everything else keeps working.
  for (const path of ["/dashboard", "/dashboard/orders", "/dashboard/licenses", "/dashboard/security", "/marketplace"]) {
    const res = await authorPage.goto(path);
    expect(res?.status(), path).toBe(200);
    await expect(authorPage).toHaveURL(new RegExp(`${path}$`));
  }
  // …and the banned member can still read the Community.
  await authorPage.goto("/community");
  await expect(authorPage.getByRole("heading", { name: "Community", exact: true })).toBeVisible();

  // Unban + lift: posting is available again.
  await admin.goto(`/admin/community/members?q=${encodeURIComponent(authorEmail)}`);
  await admin.getByRole("button", { name: "Unban" }).click();
  await expect(admin.getByRole("button", { name: "Unban" })).toHaveCount(0, { timeout: 15_000 });
  await admin.getByRole("button", { name: "Lift" }).click();
  await expect(admin.getByRole("button", { name: "Lift" })).toHaveCount(0, { timeout: 15_000 });
  await authorPage.goto("/community/new");
  await expect(authorPage.locator("#post-title")).toBeVisible();

  // Everything above is recorded in the moderation history.
  await admin.goto("/admin/community/history");
  await expect(admin.getByText("community.user.banned").first()).toBeVisible();
  await expect(admin.getByText("community.user.posting_suspended").first()).toBeVisible();
  await admin.context().close();
});

test("the Community is usable on a phone (no sideways scroll, collapsible navigation, readable thread)", async ({ browser }) => {
  const phone = await newSignedInPage(browser, `e2e-community-phone-${suffix}@fxbotmarket.local`, "Phone Member", { width: 375, height: 812 });
  const noSidewaysScroll = async (path: string) => {
    await phone.goto(path);
    await phone.waitForLoadState("networkidle");
    const { scrollWidth, innerWidth } = await phone.evaluate(() => ({ scrollWidth: document.documentElement.scrollWidth, innerWidth: window.innerWidth }));
    expect(scrollWidth, `${path} overflows horizontally`).toBeLessThanOrEqual(innerWidth);
  };
  await noSidewaysScroll("/community");
  await noSidewaysScroll("/community/new");
  await noSidewaysScroll(postUrl);

  await phone.goto("/community");
  const browse = phone.getByRole("button", { name: /Browse communities/ });
  await browse.click();
  await expect(phone.getByRole("link", { name: "Trading ideas" }).first()).toBeVisible();
  await phone.context().close();
});

test.afterAll(async () => {
  await authorPage?.context().close();
});
