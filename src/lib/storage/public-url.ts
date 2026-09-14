// Deliberately does NOT import from "@/lib/env": this file is called from
// Client Components (product cards, the asset manager) to build <img> src
// values, so it must be safe to bundle for the browser. "@/lib/env" parses
// every server secret (DATABASE_URL, AUTH_SECRET, ...) via Zod at module
// load, which throws in a browser bundle where those aren't defined. Only
// NEXT_PUBLIC_-prefixed vars are available (and statically inlined) on the
// client, so that's the only thing this file may read.
const PUBLIC_BASE_URL = process.env.NEXT_PUBLIC_STORAGE_PUBLIC_BASE_URL ?? "";

/**
 * Public-read URL for an object (product images/screenshots). Product
 * files (EA/indicator downloads) must never use this — resolve those with
 * StorageProvider.getSignedDownloadUrl() instead, which is time-limited and
 * server-only.
 */
export function getPublicUrl(storageKey: string): string {
  const base = PUBLIC_BASE_URL.replace(/\/$/, "");
  return `${base}/${storageKey.replace(/^\//, "")}`;
}
