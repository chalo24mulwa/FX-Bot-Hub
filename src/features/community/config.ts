import { env } from "@/lib/env";

/** Chart uploads need real object storage; without it the upload option is switched off instead of failing later. */
export function imageUploadsConfigured(): boolean {
  return !!env.STORAGE_ACCESS_KEY_ID && !!env.STORAGE_SECRET_ACCESS_KEY && !!process.env.NEXT_PUBLIC_STORAGE_PUBLIC_BASE_URL;
}
