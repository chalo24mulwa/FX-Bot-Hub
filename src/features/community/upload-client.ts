// Browser-only helpers for Community chart/screenshot uploads. Same
// direct-to-storage flow as product images: presign -> PUT to the bucket.
// The server never receives the bytes; it only mints a URL for a key inside
// the member's own folder and later HEADs the object before a post may use it.

import { UPLOAD_LIMITS } from "@/lib/storage/validate-upload";

const MAX_EDGE = 1920;
const COMPRESS_ABOVE_BYTES = 1_500_000;

export function checkImageFile(file: File): string | null {
  if (!(UPLOAD_LIMITS.image.contentTypes as readonly string[]).includes(file.type)) return "Images must be PNG, JPG or WebP.";
  if (file.size > UPLOAD_LIMITS.image.maxBytes) return `Images can be at most ${Math.round(UPLOAD_LIMITS.image.maxBytes / 1_048_576)} MB.`;
  return null;
}

/**
 * Screenshots are often 4K PNGs of several MB. Before upload, anything wider
 * than 1920px (or heavy) is redrawn on a canvas and re-encoded as WebP —
 * "image optimisation" that costs the member nothing and saves everyone
 * bandwidth. Falls back to the original file if the browser can't do it.
 */
export async function optimizeImage(file: File): Promise<File> {
  try {
    if (typeof createImageBitmap !== "function") return file;
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
    if (scale === 1 && file.size <= COMPRESS_ABOVE_BYTES) {
      bitmap.close();
      return file;
    }
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/webp", 0.86));
    if (!blob || blob.type !== "image/webp" || blob.size >= file.size) return file;
    return new File([blob], file.name.replace(/\.[^.]+$/, "") + ".webp", { type: "image/webp" });
  } catch {
    return file;
  }
}

export async function uploadCommunityImage(original: File): Promise<{ storageKey: string; file: File }> {
  const invalid = checkImageFile(original);
  if (invalid) throw new Error(invalid);
  const file = await optimizeImage(original);

  const res = await fetch("/api/community/uploads/presign", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ fileName: file.name, contentType: file.type, sizeBytes: file.size }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.error ?? "Couldn't start the upload.");
  }
  const { uploadUrl, storageKey } = (await res.json()) as { uploadUrl: string; storageKey: string };

  let put: Response;
  try {
    put = await fetch(uploadUrl, { method: "PUT", headers: { "Content-Type": file.type }, body: file });
  } catch {
    throw new Error("Couldn't reach file storage. Check your connection and try again.");
  }
  if (!put.ok) throw new Error("Upload to storage failed.");
  return { storageKey, file };
}
