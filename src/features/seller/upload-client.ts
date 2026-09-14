// Browser-only helpers for the seller product wizard's upload steps.
// Flow: presign -> PUT directly to storage -> attach (create the DB row).
// The server never sees file bytes; checksums are computed here so the DB
// row can record integrity info without the server re-reading the object.

export type UploadKind = "productFile" | "image" | "documentation";

export async function sha256Hex(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const digest = await crypto.subtle.digest("SHA-256", buffer);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function presign(productId: string, kind: UploadKind, file: File) {
  const res = await fetch("/api/seller/uploads/presign", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      productId,
      kind,
      fileName: file.name,
      contentType: file.type || "application/octet-stream",
      sizeBytes: file.size,
    }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.error ?? "Failed to get an upload URL.");
  }
  return (await res.json()) as { uploadUrl: string; storageKey: string };
}

async function putToStorage(uploadUrl: string, file: File) {
  const res = await fetch(uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": file.type || "application/octet-stream" },
    body: file,
  });
  if (!res.ok) throw new Error("Upload to storage failed.");
}

export async function uploadAndAttachImage(productId: string, file: File, altText?: string) {
  const { uploadUrl, storageKey } = await presign(productId, "image", file);
  await putToStorage(uploadUrl, file);
  return attach(productId, { assetType: "image", storageKey, altText });
}

export async function uploadAndAttachScreenshot(productId: string, file: File, caption?: string) {
  const { uploadUrl, storageKey } = await presign(productId, "image", file);
  await putToStorage(uploadUrl, file);
  return attach(productId, { assetType: "screenshot", storageKey, caption });
}

export async function uploadAndAttachDocumentationFile(productId: string, file: File, title: string) {
  const { uploadUrl, storageKey } = await presign(productId, "documentation", file);
  await putToStorage(uploadUrl, file);
  return attach(productId, { assetType: "documentation", title, storageKey });
}

export async function uploadAndAttachProductFile(
  productId: string,
  file: File,
  meta: { version: string; changelog?: string; platform: "MT4" | "MT5" | "MULTI_PLATFORM" }
) {
  const [{ uploadUrl, storageKey }, checksumSha256] = await Promise.all([
    presign(productId, "productFile", file),
    sha256Hex(file),
  ]);
  await putToStorage(uploadUrl, file);
  return attach(productId, {
    assetType: "file",
    storageKey,
    fileName: file.name,
    fileSizeBytes: file.size,
    checksumSha256,
    ...meta,
  });
}

async function attach(productId: string, payload: Record<string, unknown>) {
  const res = await fetch(`/api/seller/products/${productId}/assets`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.error ?? "Failed to save the upload.");
  }
  return res.json();
}
