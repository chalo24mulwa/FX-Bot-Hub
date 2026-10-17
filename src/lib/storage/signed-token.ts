import { createHmac, timingSafeEqual } from "node:crypto";

// Tokens for the database storage provider's upload/download URLs: a base64url JSON payload plus an
// HMAC-SHA256 signature over it (AUTH_SECRET), with an expiry. The provider mints them exactly where
// S3 would mint a presigned URL, so callers (presign routes, the entitlement-checked download route)
// are unchanged.

export interface StorageTokenPayload {
  /** "u" upload, "d" download. A token minted for one can never be used for the other. */
  m: "u" | "d";
  /** Object key. */
  k: string;
  /** Content type the upload was presigned for (uploads only). */
  t?: string;
  /** Expiry, epoch seconds. */
  e: number;
}

function sign(secret: string, body: string): string {
  return createHmac("sha256", secret).update(body).digest("base64url");
}

export function createStorageToken(secret: string, payload: StorageTokenPayload): string {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${body}.${sign(secret, body)}`;
}

export function readStorageToken(secret: string, token: string, mode: "u" | "d", nowSeconds = Math.floor(Date.now() / 1000)): StorageTokenPayload | null {
  const [body, signature, ...rest] = token.split(".");
  if (!body || !signature || rest.length) return null;
  const expected = Buffer.from(sign(secret, body));
  const given = Buffer.from(signature);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as StorageTokenPayload;
    if (payload.m !== mode || typeof payload.k !== "string" || typeof payload.e !== "number") return null;
    if (payload.e < nowSeconds) return null;
    return payload;
  } catch {
    return null;
  }
}
