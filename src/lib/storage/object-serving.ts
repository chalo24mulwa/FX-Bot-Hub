import { UPLOAD_LIMITS, fileExtension } from "./validate-upload";

// Pure helpers for the database-backed storage routes (src/app/api/storage/*), unit-tested.

const IMAGE_TYPES: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
};

const INLINE_DOC_TYPES: Record<string, string> = {
  ".pdf": "application/pdf",
  ".txt": "text/plain; charset=utf-8",
  ".md": "text/plain; charset=utf-8",
  ".csv": "text/plain; charset=utf-8",
};

/** Largest body an upload for this key may carry; null when the key isn't one the app mints. */
export function maxBytesForKey(key: string): number | null {
  if (key.includes("..")) return null;
  const parts = key.split("/");
  if (parts[0] === "community" && parts.length >= 3) return UPLOAD_LIMITS.image.maxBytes;
  if (parts[0] === "products" && parts.length >= 4) {
    if (parts[2] === "productFile") return UPLOAD_LIMITS.productFile.maxBytes;
    if (parts[2] === "image") return UPLOAD_LIMITS.image.maxBytes;
    if (parts[2] === "documentation") return UPLOAD_LIMITS.documentation.maxBytes;
  }
  return null;
}

/** Only images and documentation are publicly readable; product files are signed-download only. */
export function isPubliclyReadableKey(key: string): boolean {
  if (key.includes("..") || key.includes("\\")) return false;
  const parts = key.split("/");
  if (parts[0] === "community") return parts.length >= 3;
  return parts[0] === "products" && parts.length >= 4 && (parts[2] === "image" || parts[2] === "documentation");
}

/**
 * How a publicly readable object is delivered. The stored content type came from the uploader, so it
 * is never echoed: images get a fixed image type, a few text formats are shown as plain text, a PDF
 * inline, and everything else downloads as an opaque attachment.
 */
export function publicDelivery(key: string): { contentType: string; inline: boolean } {
  const ext = fileExtension(key);
  if (IMAGE_TYPES[ext]) return { contentType: IMAGE_TYPES[ext], inline: true };
  if (INLINE_DOC_TYPES[ext]) return { contentType: INLINE_DOC_TYPES[ext], inline: true };
  return { contentType: "application/octet-stream", inline: false };
}

/** "products/<id>/productFile/<uuid>-name.zip" becomes "name.zip". */
export function downloadFileName(key: string): string {
  const last = key.split("/").pop() ?? "download";
  return last.replace(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}-/i, "") || "download";
}

/** Header-safe attachment/inline disposition. */
export function contentDisposition(kind: "attachment" | "inline", fileName: string): string {
  const ascii = fileName.replace(/[^\x20-\x7e]/g, "_").replace(/["\\]/g, "_");
  return `${kind}; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(fileName)}`;
}
