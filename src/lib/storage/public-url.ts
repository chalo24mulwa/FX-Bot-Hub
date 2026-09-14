import { env } from "@/lib/env";

/**
 * Public-read URL for an object (product images/screenshots). Product
 * files (EA/indicator downloads) must never use this — resolve those with
 * StorageProvider.getSignedDownloadUrl() instead, which is time-limited.
 */
export function getPublicUrl(storageKey: string): string {
  const base = env.STORAGE_PUBLIC_BASE_URL ?? `${env.STORAGE_ENDPOINT ?? ""}/${env.STORAGE_BUCKET}`;
  return `${base.replace(/\/$/, "")}/${storageKey.replace(/^\//, "")}`;
}
