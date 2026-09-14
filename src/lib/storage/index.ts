import type { StorageProvider } from "./types";
import { S3StorageProvider } from "./s3-provider";

export type { StorageProvider, PutObjectInput } from "./types";

// Single seam for the rest of the app. Swapping providers (e.g. adding a
// local-disk provider for tests) means adding a branch here only.
export const storage: StorageProvider = new S3StorageProvider();
