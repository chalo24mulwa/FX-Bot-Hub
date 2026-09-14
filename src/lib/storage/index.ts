import type { StorageProvider } from "./types";
import { S3StorageProvider } from "./s3-provider";

export type { StorageProvider, PutObjectInput } from "./types";
export { getPublicUrl } from "./public-url";
export { validateUpload, UPLOAD_LIMITS } from "./validate-upload";

// Single seam for the rest of the app. Swapping providers (e.g. adding a
// local-disk provider for tests) means adding a branch here only.
export const storage: StorageProvider = new S3StorageProvider();
