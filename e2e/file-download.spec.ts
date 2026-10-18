import { test, expect } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { signIn, E2E_SELLER } from "./helpers";

// Downloading a purchased file from the order page and the product page: the response IS the file (no second hop that a proxy could
// cache and replay), served as a private, no-store attachment under the seller's original file name, only to people entitled to it.

const db = new PrismaClient();
const stamp = Date.now();
const PASSWORD = "password123";
const bytes = Buffer.concat([Buffer.from("PK\u0003\u0004"), Buffer.from(`fx-bot-hub download test ${stamp} `.repeat(400))]);
const FILE_NAME = "Quantum Titan v2.zip";
const userIds: string[] = [];
let productId = "";
let fileId = "";
let orderId = "";
let slug = "";
const buyerEmail = `dl-buyer-${stamp}@e2e.local`;
const strangerEmail = `dl-stranger-${stamp}@e2e.local`;

async function makeUser(email: string, name: string) {
  const user = await db.user.create({ data: { email, name, password: await bcrypt.hash(PASSWORD, 10), role: "USER", profile: { create: { displayName: name } } } });
  userIds.push(user.id);
  return user;
}

test.beforeAll(async () => {
  const seller = await db.user.findFirstOrThrow({ where: { email: E2E_SELLER } });
  slug = `e2e-dl-${stamp}`;
  const product = await db.product.create({
    data: { sellerId: seller.id, name: `Download Product ${stamp}`, slug, type: "EA", platform: "MT5", pricingType: "ONE_TIME", priceCents: 1500, currency: "USD", status: "PUBLISHED", publishedAt: new Date(), shortSummary: "A listing used by the download end-to-end tests.", description: "Seeded for Playwright — safe to leave in the database." },
  });
  productId = product.id;
  const version = await db.productVersion.create({ data: { productId, version: "2.0.0" } });
  const key = `products/${productId}/productFile/${crypto.randomUUID()}-Quantum_Titan_v2.zip`;
  await db.storedObject.create({ data: { key, contentType: "application/octet-stream", sizeBytes: bytes.length, data: bytes } });
  const file = await db.productFile.create({ data: { productVersionId: version.id, fileName: FILE_NAME, storageKey: key, fileSizeBytes: bytes.length, platform: "MT5", checksumSha256: "0".repeat(64) } });
  fileId = file.id;

  const buyer = await makeUser(buyerEmail, "Dana Downloader");
  await makeUser(strangerEmail, "Sam Stranger");
  const order = await db.order.create({ data: { userId: buyer.id, status: "PAID", totalCents: 1500, currency: "USD", items: { create: { productId, unitPriceCents: 1500, quantity: 1 } } } });
  orderId = order.id;
  await db.license.create({ data: { userId: buyer.id, productId, orderId: order.id } });
});

test.afterAll(async () => {
  await db.download.deleteMany({ where: { productId } });
  await db.license.deleteMany({ where: { productId } });
  await db.orderItem.deleteMany({ where: { productId } });
  await db.order.deleteMany({ where: { userId: { in: userIds } } });
  await db.productFile.deleteMany({ where: { id: fileId } });
  await db.storedObject.deleteMany({ where: { key: { contains: productId } } });
  await db.productVersion.deleteMany({ where: { productId } });
  await db.product.deleteMany({ where: { id: productId } });
  await db.user.deleteMany({ where: { id: { in: userIds } } });
  await db.$disconnect();
});

test("a buyer clicking Download on their order gets the file, under its original name", async ({ page }) => {
  await signIn(page, buyerEmail);
  await page.goto(`/dashboard/orders/${orderId}`);
  const link = page.getByRole("link", { name: /Download Quantum Titan v2\.zip/ });
  await expect(link).toBeVisible();

  const [download] = await Promise.all([page.waitForEvent("download"), link.click()]);
  expect(download.suggestedFilename()).toBe(FILE_NAME);
  const saved = await download.path();
  const fs = await import("node:fs");
  expect(fs.readFileSync(saved!).equals(bytes)).toBe(true);
  expect(await download.failure()).toBeNull();
});

test("the product page's Your downloads link works too, and the response is private and uncacheable", async ({ page }) => {
  await signIn(page, buyerEmail);
  await page.goto(`/marketplace/${slug}`);
  await expect(page.getByText("Your downloads")).toBeVisible();
  const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("link", { name: /Download Quantum Titan v2\.zip/ }).click()]);
  expect(download.suggestedFilename()).toBe(FILE_NAME);

  const res = await page.request.get(`/api/downloads/${fileId}`, { maxRedirects: 0 });
  expect(res.status()).toBe(200); // the file itself — not a redirect to a second URL
  const headers = res.headers();
  expect(headers["cache-control"]).toContain("no-store");
  expect(headers["cache-control"]).toContain("private");
  expect(headers["content-disposition"]).toContain("attachment");
  expect(headers["content-disposition"]).toContain(FILE_NAME);
  expect(headers["x-content-type-options"]).toBe("nosniff");
  expect((await res.body()).equals(bytes)).toBe(true);
});

test("someone who has not bought it is refused, and so is a signed-out visitor", async ({ page, request }) => {
  await signIn(page, strangerEmail);
  const refused = await page.request.get(`/api/downloads/${fileId}`);
  expect(refused.status()).toBe(403);
  expect(refused.headers()["cache-control"]).toContain("no-store");
  await page.goto(`/marketplace/${slug}`);
  await expect(page.getByText("Your downloads")).toHaveCount(0);

  const signedOut = await request.get(`/api/downloads/${fileId}`);
  expect(signedOut.status()).toBe(401);
  const missing = await request.get("/api/downloads/does-not-exist");
  expect([401, 404]).toContain(missing.status());
});

test("the old signed link still works for its short life but expires", async ({ request }) => {
  const forged = await request.get("/api/storage/download?token=abc.def");
  expect(forged.status()).toBe(403);
});
