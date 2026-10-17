import { describe, expect, it } from "vitest";
import { validateUpload, UPLOAD_LIMITS } from "./validate-upload";

describe("validateUpload", () => {
  it("accepts a valid EA file", () => {
    const result = validateUpload({
      kind: "productFile",
      fileName: "trend-rider.ex5",
      contentType: "application/octet-stream",
      sizeBytes: 1024,
    });
    expect(result.ok).toBe(true);
  });

  it("accepts the formats sellers ship: archives, installers, sources, templates", () => {
    for (const fileName of ["bundle.zip", "bundle.RAR", "pack.7z", "setup.exe", "helper.dll", "ea.mq4", "lib.mqh", "ea.mql5", "preset.set", "layout.tpl", "manual.pdf"]) {
      expect(validateUpload({ kind: "productFile", fileName, contentType: "application/octet-stream", sizeBytes: 1024 }).ok, fileName).toBe(true);
    }
  });

  it("does not depend on the MIME type browsers report for MetaTrader and Windows files", () => {
    for (const contentType of ["application/x-msdownload", "application/x-zip-compressed", "application/vnd.rar", "text/plain", "application/x-7z-compressed"]) {
      expect(validateUpload({ kind: "productFile", fileName: "x.zip", contentType, sizeBytes: 10 }).ok, contentType).toBe(true);
    }
    expect(validateUpload({ kind: "productFile", fileName: "x.zip", contentType: "not a type", sizeBytes: 10 }).ok).toBe(false);
  });

  it("rejects a disallowed extension, with the allowed list in the message", () => {
    const result = validateUpload({ kind: "productFile", fileName: "page.html", contentType: "text/html", sizeBytes: 1024 });
    expect(result.ok).toBe(false);
    expect(result.error).toContain("accepted formats");
    expect(validateUpload({ kind: "productFile", fileName: "noextension", contentType: "application/octet-stream", sizeBytes: 5 }).ok).toBe(false);
    expect(validateUpload({ kind: "productFile", fileName: "script.js", contentType: "application/octet-stream", sizeBytes: 5 }).ok).toBe(false);
  });

  it("rejects a mismatched content type even with an allowed extension", () => {
    const result = validateUpload({
      kind: "image",
      fileName: "screenshot.png",
      contentType: "application/octet-stream",
      sizeBytes: 1024,
    });
    expect(result.ok).toBe(false);
  });

  it("rejects a file over the size limit", () => {
    const result = validateUpload({
      kind: "image",
      fileName: "screenshot.png",
      contentType: "image/png",
      sizeBytes: UPLOAD_LIMITS.image.maxBytes + 1,
    });
    expect(result.ok).toBe(false);
  });

  it("rejects a zero-byte file", () => {
    const result = validateUpload({
      kind: "documentation",
      fileName: "manual.pdf",
      contentType: "application/pdf",
      sizeBytes: 0,
    });
    expect(result.ok).toBe(false);
  });
});
