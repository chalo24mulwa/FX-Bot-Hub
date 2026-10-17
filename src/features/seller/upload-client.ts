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

export type ProgressHandler = (fraction: number) => void;

async function presign(productId: string, kind: UploadKind, file: File) {
  let res: Response;
  try {
    res = await fetch("/api/seller/uploads/presign", {
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
  } catch {
    throw new Error("Couldn’t reach the server. Check your connection and try again.");
  }
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.error ?? "Couldn’t start the upload. Please try again.");
  }
  return (await res.json()) as { uploadUrl: string; storageKey: string; contentType: string };
}

// XMLHttpRequest rather than fetch: it is the only way a browser reports upload progress.
function putToStorage(uploadUrl: string, file: File, contentType: string, onProgress?: ProgressHandler): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", uploadUrl);
    xhr.setRequestHeader("Content-Type", contentType);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) onProgress(e.loaded / e.total);
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        onProgress?.(1);
        resolve();
        return;
      }
      let message = "Upload to storage failed.";
      try {
        const body = JSON.parse(xhr.responseText) as { error?: string };
        if (body.error) message = body.error;
      } catch {
        // not JSON (an S3-style XML error) — keep the generic message
      }
      reject(new Error(message));
    };
    // A network-level failure (storage unreachable, blocked by CORS, offline) has no useful detail.
    xhr.onerror = () => reject(new Error("Couldn’t reach file storage. Check your connection and try again."));
    xhr.onabort = () => reject(new Error("Upload cancelled."));
    xhr.send(file);
  });
}

async function send(productId: string, kind: UploadKind, file: File, onProgress?: ProgressHandler) {
  const { uploadUrl, storageKey, contentType } = await presign(productId, kind, file);
  await putToStorage(uploadUrl, file, contentType, onProgress);
  return storageKey;
}

export async function uploadAndAttachImage(productId: string, file: File, altText?: string, onProgress?: ProgressHandler) {
  const storageKey = await send(productId, "image", file, onProgress);
  return attach(productId, { assetType: "image", storageKey, altText });
}

/** Uploads a product’s cover photo, replacing any previous one. */
export async function uploadAndSetCover(productId: string, file: File, altText?: string, onProgress?: ProgressHandler) {
  const storageKey = await send(productId, "image", file, onProgress);
  return attach(productId, { assetType: "cover", storageKey, altText });
}

export async function uploadAndAttachScreenshot(productId: string, file: File, caption?: string, onProgress?: ProgressHandler) {
  const storageKey = await send(productId, "image", file, onProgress);
  return attach(productId, { assetType: "screenshot", storageKey, caption });
}

export async function uploadAndAttachDocumentationFile(productId: string, file: File, title: string, onProgress?: ProgressHandler) {
  const storageKey = await send(productId, "documentation", file, onProgress);
  return attach(productId, { assetType: "documentation", title, storageKey });
}

export async function uploadAndAttachProductFile(
  productId: string,
  file: File,
  meta: { version: string; changelog?: string; platform: "MT4" | "MT5" | "MULTI_PLATFORM" },
  onProgress?: ProgressHandler
) {
  const [storageKey, checksumSha256] = await Promise.all([send(productId, "productFile", file, onProgress), sha256Hex(file)]);
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
    throw new Error(body?.error ?? "The file uploaded but couldn’t be saved to your product. Please try again.");
  }
  return res.json();
}
