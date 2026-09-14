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

  it("rejects a disallowed extension", () => {
    const result = validateUpload({
      kind: "productFile",
      fileName: "malware.exe",
      contentType: "application/octet-stream",
      sizeBytes: 1024,
    });
    expect(result.ok).toBe(false);
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
