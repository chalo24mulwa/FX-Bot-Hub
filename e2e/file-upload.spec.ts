import { deflateSync, crc32 } from "node:zlib";
import { test, expect, type Page } from "@playwright/test";
import { signIn, E2E_SELLER } from "./helpers";

// The seller upload areas run against the built-in database storage (playwright.config.ts blanks the
// STORAGE_* variables, the same state as production today), so these are REAL uploads, downloads and
// image reads — not just UI checks.

const TINY_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
  "base64",
);

/** A valid solid-colour PNG of any size (the 1x1 fixture is too small to exercise the image optimizer meaningfully). */
function solidPng(width: number, height: number): Buffer {
  const chunk = (type: string, data: Buffer) => {
    const length = Buffer.alloc(4);
    length.writeUInt32BE(data.length);
    const body = Buffer.concat([Buffer.from(type), data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(body) >>> 0);
    return Buffer.concat([length, body, crc]);
  };
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8; // bit depth
  header[9] = 2; // RGB
  const row = Buffer.concat([Buffer.from([0]), Buffer.alloc(width * 3, 0x66)]);
  const pixels = Buffer.concat(Array.from({ length: height }, () => row));
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", header), chunk("IDAT", deflateSync(pixels)), chunk("IEND", Buffer.alloc(0))]);
}

async function startDraft(page: Page, name: string) {
  await page.goto("/seller/products/new");
  const next = page.locator("main").getByRole("button", { name: "Next", exact: true });
  await next.click(); // type
  await next.click(); // platform
  await page.getByLabel("Product name").fill(name);
  await page.getByLabel("Short summary").fill("An end-to-end test product for the upload areas.");
  await next.click();
  await page.getByLabel("Description").fill("Created by a Playwright test exercising the file upload areas.");
  await next.click(); // creates the draft
  await expect(page.getByText(/uploaded so far/)).toBeVisible();
  return next;
}

test("screenshots and product files upload from a clear Browse area, in many formats, and download intact", async ({ browser }) => {
  const context = await browser.newContext();
  const page = await context.newPage();
  await signIn(page, E2E_SELLER);
  const productName = `E2E Upload Product ${Date.now()}`;
  const next = await startDraft(page, productName);

  // ---- Screenshots step: one compact, left-aligned "Browse or drag" button, not a wide area.
  const area = page.getByTestId("dropzone");
  await expect(area).toBeVisible();
  await expect(area).toContainText("Browse or drag screenshots here");
  const areaBox = (await area.boundingBox())!;
  expect(areaBox.height).toBeGreaterThanOrEqual(44);
  expect(areaBox.height).toBeLessThanOrEqual(80); // a button, not a big panel
  expect(areaBox.width).toBeLessThanOrEqual(420);
  const heading = (await page.getByText("Add a few screenshots (optional)").boundingBox())!;
  expect(Math.abs(areaBox.x - heading.x)).toBeLessThanOrEqual(2); // aligned with the text above it, i.e. left
  await expect(page.getByLabel("Accepted formats")).toContainText(".png");

  const input = area.locator('input[type="file"]');
  await expect(input).toHaveAttribute("multiple", "");
  await input.setInputFiles([
    { name: "chart-1.png", mimeType: "image/png", buffer: TINY_PNG },
    { name: "chart-2.png", mimeType: "image/png", buffer: TINY_PNG },
  ]);
  await expect(page.getByText("2 uploaded so far")).toBeVisible({ timeout: 15_000 });
  await expect(page.locator('li[data-status="done"]')).toHaveCount(2);

  // A format that isn't an image is refused with a plain-language message and nothing is queued.
  await input.setInputFiles({ name: "notes.txt", mimeType: "text/plain", buffer: Buffer.from("hello") });
  await expect(page.getByRole("alert").filter({ hasText: "notes.txt" })).toContainText("can't be uploaded");
  await expect(page.locator('li[data-status="done"]')).toHaveCount(2);

  await next.click(); // -> Files

  // ---- Files step: zip, MQL source, exe and a MetaTrader binary, with MIME types browsers really report.
  const files = page.getByTestId("dropzone");
  await expect(files).toContainText("Browse or drag files here");
  // Only five MetaTrader formats are named; zip/exe and the rest are accepted but not listed.
  const formats = page.getByLabel("Accepted formats");
  await expect(formats).toContainText(".ex4");
  await expect(formats).toContainText(".set");
  await expect(formats).not.toContainText(".zip");
  await expect(formats).not.toContainText(".exe");
  expect((((await formats.innerText()).match(/\.[a-z0-9]{2,5}\b/g) ?? []).length)).toBeLessThanOrEqual(5);
  const zip = Buffer.concat([Buffer.from("PK\u0003\u0004"), Buffer.from("fx-bot-hub e2e archive ".repeat(500))]);
  await files.locator('input[type="file"]').setInputFiles([
    { name: "My EA Bundle v1.zip", mimeType: "application/x-zip-compressed", buffer: zip },
    { name: "TrendRider.mq5", mimeType: "", buffer: Buffer.from("// MQL5 source\nint OnInit(){return(INIT_SUCCEEDED);}\n") },
    { name: "Installer.exe", mimeType: "application/x-msdownload", buffer: Buffer.from("MZ" + "\u0000".repeat(64)) },
    { name: "Bot.ex5", mimeType: "application/octet-stream", buffer: Buffer.from("binary-ex5-content") },
  ]);
  await expect(page.getByText("4 uploaded so far")).toBeVisible({ timeout: 20_000 });
  await expect(page.locator('li[data-status="done"]')).toHaveCount(4);

  // Unsupported formats are rejected up front, and say what is accepted.
  await files.locator('input[type="file"]').setInputFiles({ name: "page.html", mimeType: "text/html", buffer: Buffer.from("<b>x</b>") });
  await expect(page.getByRole("alert").filter({ hasText: "page.html" })).toContainText("MetaTrader file");

  // ---- The product page lists the files, the screenshots render, and the owner can download the bytes back.
  await next.click(); // pricing
  await page.locator("main").getByRole("button", { name: "Free", exact: true }).click();
  await next.click(); // compatibility
  await next.click(); // submit step
  await page.getByRole("button", { name: "Submit for review" }).click();
  await expect(page).toHaveURL(/\/seller\/products\/(?!new$)[a-z0-9]+$/, { timeout: 15_000 });
  const productId = page.url().split("/").pop()!;

  const shot = page.locator('img[src^="/api/storage/public/"]').first();
  await expect(shot).toBeVisible();
  expect(await shot.evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth > 0)).toBe(true);

  const assetsRes = await page.request.get(`/api/seller/products/${productId}/assets`);
  expect(assetsRes.status(), await assetsRes.text()).toBe(200);
  const assets = await assetsRes.json();
  const stored = assets.versions.flatMap((v: { files: { id: string; fileName: string }[] }) => v.files);
  expect(stored.map((f: { fileName: string }) => f.fileName).sort()).toEqual(["Bot.ex5", "Installer.exe", "My EA Bundle v1.zip", "TrendRider.mq5"]);
  const zipRow = stored.find((f: { fileName: string }) => f.fileName.endsWith(".zip"));
  const download = await page.request.get(`/api/downloads/${zipRow.id}`);
  expect(download.status()).toBe(200);
  expect(download.headers()["content-disposition"]).toContain("My EA Bundle v1.zip");
  expect((await download.body()).equals(zip)).toBe(true);

  // A cover photo saved from the edit page renders through next/image on the seller's product list.
  await page.locator("#cover-photo-input").setInputFiles({ name: "cover.png", mimeType: "image/png", buffer: solidPng(320, 200) });
  await expect(page.getByText("Cover photo saved.")).toBeVisible({ timeout: 15_000 });
  await page.goto("/seller/products");
  // Scoped to this product's own row: the list shows every product the seller has.
  const thumb = page.locator(`a[href="/seller/products/${productId}"] img`).first();
  await expect(thumb).toBeVisible();
  await expect.poll(() => thumb.evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth > 0)).toBe(true);

  // A product file is never readable through the public image/document route.
  const key = (await (await page.request.get(`/api/seller/products/${productId}/assets`)).json()).versions[0].files[0].storageKey as string;
  const leak = await page.request.get(`/api/storage/public/${key}`);
  expect(leak.status()).toBe(404);
  await context.close();
});

test("the database upload endpoint refuses forged, expired and oversized requests", async ({ request }) => {
  const forged = await request.put("/api/storage/upload?token=abc.def", { data: Buffer.from("x"), headers: { "Content-Type": "application/octet-stream" } });
  expect(forged.status()).toBe(403);
  const dl = await request.get("/api/storage/download?token=abc.def");
  expect(dl.status()).toBe(403);
  const missing = await request.get("/api/storage/public/products/nope/image/none.png");
  expect(missing.status()).toBe(404);
});

test("the upload areas fit a phone screen and the Browse button stays a comfortable tap target", async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 375, height: 667 } });
  const page = await context.newPage();
  await signIn(page, E2E_SELLER);
  await startDraft(page, `E2E Upload Phone ${Date.now()}`);
  const area = page.getByTestId("dropzone");
  await expect(area).toContainText("Browse or drag screenshots here");
  const button = (await area.boundingBox())!;
  expect(button.height).toBeGreaterThanOrEqual(44);
  expect(button.x).toBeLessThanOrEqual(24); // left-aligned within the page gutter
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
  await page.locator("main").getByRole("button", { name: "Next", exact: true }).click();
  await expect(page.getByTestId("dropzone")).toContainText("Browse or drag files here");
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
  await context.close();
});
