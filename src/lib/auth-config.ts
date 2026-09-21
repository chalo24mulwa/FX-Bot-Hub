import { env } from "@/lib/env";

/**
 * Whether "Continue with Google" is usable. Mirrors the condition src/lib/auth.ts
 * uses to register the Google provider, so the button is never shown for a
 * provider that doesn't exist. Server-only (reads `@/lib/env`, which parses every
 * server secret) — pages pass the resulting boolean to their client forms; the
 * client id/secret themselves never reach the browser.
 */
export function isGoogleAuthConfigured(): boolean {
  return Boolean(env.AUTH_GOOGLE_ID && env.AUTH_GOOGLE_SECRET);
}
