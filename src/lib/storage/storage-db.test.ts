import { describe, expect, it } from "vitest";
import { createStorageToken, readStorageToken } from "./signed-token";
import {
  contentDisposition,
  downloadFileName,
  isPubliclyReadableKey,
  maxBytesForKey,
  publicDelivery,
} from "./object-serving";
import { UPLOAD_LIMITS, acceptAttribute, describeRejection } from "./validate-upload";

const SECRET = "test-secret-with-enough-length";
const now = 1_800_000_000;

describe("storage tokens", () => {
  it("round-trips an upload token and refuses it for download", () => {
    const token = createStorageToken(SECRET, { m: "u", k: "products/p1/productFile/a-b.zip", t: "application/octet-stream", e: now + 300 });
    expect(readStorageToken(SECRET, token, "u", now)?.k).toBe("products/p1/productFile/a-b.zip");
    expect(readStorageToken(SECRET, token, "d", now)).toBeNull();
  });

  it("rejects expired, tampered, re-signed and malformed tokens", () => {
    const token = createStorageToken(SECRET, { m: "d", k: "products/p1/productFile/x.zip", e: now + 10 });
    expect(readStorageToken(SECRET, token, "d", now + 11)).toBeNull();
    expect(readStorageToken("another-secret-another-secret", token, "d", now)).toBeNull();
    const [body, sig] = token.split(".");
    const forged = Buffer.from(JSON.stringify({ m: "d", k: "products/p2/productFile/y.zip", e: now + 10 })).toString("base64url");
    expect(readStorageToken(SECRET, `${forged}.${sig}`, "d", now)).toBeNull();
    expect(readStorageToken(SECRET, `${body}.`, "d", now)).toBeNull();
    expect(readStorageToken(SECRET, "garbage", "d", now)).toBeNull();
    expect(readStorageToken(SECRET, `${token}.extra`, "d", now)).toBeNull();
  });
});

describe("database storage keys", () => {
  it("caps each upload by the kind in its key and rejects keys the app never mints", () => {
    expect(maxBytesForKey("products/p1/productFile/u-a.zip")).toBe(UPLOAD_LIMITS.productFile.maxBytes);
    expect(maxBytesForKey("products/p1/image/u-a.png")).toBe(UPLOAD_LIMITS.image.maxBytes);
    expect(maxBytesForKey("products/p1/documentation/u-a.pdf")).toBe(UPLOAD_LIMITS.documentation.maxBytes);
    expect(maxBytesForKey("community/user1/u-a.webp")).toBe(UPLOAD_LIMITS.image.maxBytes);
    expect(maxBytesForKey("products/p1/other/u-a.zip")).toBeNull();
    expect(maxBytesForKey("../etc/passwd")).toBeNull();
    expect(maxBytesForKey("products/p1/image/../../x")).toBeNull();
  });

  it("publishes only images and documentation, never product files", () => {
    expect(isPubliclyReadableKey("products/p1/image/u-a.png")).toBe(true);
    expect(isPubliclyReadableKey("products/p1/documentation/u-a.pdf")).toBe(true);
    expect(isPubliclyReadableKey("community/user1/u-a.webp")).toBe(true);
    expect(isPubliclyReadableKey("products/p1/productFile/u-a.zip")).toBe(false);
    expect(isPubliclyReadableKey("products/p1/image/../productFile/u-a.zip")).toBe(false);
    expect(isPubliclyReadableKey("")).toBe(false);
  });

  it("never echoes an uploader-chosen content type for public objects", () => {
    expect(publicDelivery("products/p1/image/u-a.png")).toEqual({ contentType: "image/png", inline: true });
    expect(publicDelivery("products/p1/documentation/u-a.pdf").contentType).toBe("application/pdf");
    expect(publicDelivery("products/p1/documentation/u-a.md").contentType).toContain("text/plain");
    expect(publicDelivery("products/p1/documentation/u-a.docx")).toEqual({ contentType: "application/octet-stream", inline: false });
  });

  it("builds a safe download name and header", () => {
    const key = "products/p1/productFile/0b1c2d3e-0000-4000-8000-123456789abc-My_EA_v1.zip";
    expect(downloadFileName(key)).toBe("My_EA_v1.zip");
    const header = contentDisposition("attachment", 'we"ird\r\nname.zip');
    expect(header).not.toMatch(/[\r\n]/);
    expect(header.startsWith("attachment;")).toBe(true);
  });
});

describe("upload areas", () => {
  it("offers the formats sellers asked for in the file picker", () => {
    const accept = acceptAttribute("productFile").split(",");
    for (const ext of [".zip", ".mql", ".mql5", ".mq4", ".ex5", ".exe", ".rar", ".7z", ".set", ".tpl"]) expect(accept).toContain(ext);
  });

  it("explains a rejection in plain words, naming the file and the limit", () => {
    expect(describeRejection({ kind: "productFile", fileName: "x.html", contentType: "text/html", sizeBytes: 1 })).toContain("x.html");
    expect(describeRejection({ kind: "image", fileName: "huge.png", contentType: "image/png", sizeBytes: 9 * 1024 * 1024 })).toContain("8 MB");
    expect(describeRejection({ kind: "image", fileName: "ok.png", contentType: "image/png", sizeBytes: 5 })).toBeNull();
  });
});
