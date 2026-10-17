import type { StorageProvider } from "./types";
import { S3StorageProvider } from "./s3-provider";
import { DatabaseStorageProvider } from "./database-provider";
import { env } from "@/lib/env";

export type { StorageProvider, PutObjectInput } from "./types";
export { getPublicUrl } from "./public-url";
export { validateUpload, UPLOAD_LIMITS, type UploadKind } from "./validate-upload";

/**
 * True when a real S3-compatible bucket is configured (credentials + the public base URL images are
 * served from). Otherwise uploads are kept in the database, so sellers can still list products on a
 * host with no object storage. Setting STORAGE_* later switches new uploads to the bucket; objects
 * already in the database keep being served from it.
 */
export function externalStorageConfigured(): boolean {
  return !!env.STORAGE_ACCESS_KEY_ID && !!env.STORAGE_SECRET_ACCESS_KEY && !!process.env.NEXT_PUBLIC_STORAGE_PUBLIC_BASE_URL;
}

// Single seam for the rest of the app. Swapping providers (e.g. adding a
// local-disk provider for tests) means adding a branch here only.
export const storage: StorageProvider = externalStorageConfigured() ? new S3StorageProvider() : new DatabaseStorageProvider();
