const DEFAULT_SITE_URL = "http://localhost:3000";

/** Strips surrounding whitespace and one layer of matching quotes (some hosts write `KEY='value'`). */
function clean(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const trimmed = value.trim();
  const quoted = /^(['"])(.*)\1$/.exec(trimmed);
  return quoted ? quoted[2].trim() : trimmed;
}

function isHttpUrl(value: string): boolean {
  try {
    const { protocol } = new URL(value);
    return protocol === "http:" || protocol === "https:";
  } catch {
    return false;
  }
}

/**
 * The site's base URL for metadata (`metadataBase`), resolved defensively.
 *
 * `new URL(process.env.NEXT_PUBLIC_APP_URL)` throws on a malformed value, and because
 * it runs at module load in the root layout, one bad environment variable failed the
 * whole production build — a real deploy broke when the host's env file ended up with
 * another variable glued onto this one. Base-URL metadata is not worth taking the site
 * down, so: try the app URL, then the auth URL, then localhost, accepting only http(s).
 *
 * A rejected value is reported by variable *name* only — never its contents, which in
 * exactly that incident included an API key.
 */
export function resolveSiteUrl(env: Record<string, string | undefined> = process.env): string {
  for (const name of ["NEXT_PUBLIC_APP_URL", "NEXTAUTH_URL", "AUTH_URL"]) {
    const value = clean(env[name]);
    if (!value) continue;
    if (isHttpUrl(value)) return value;
    console.warn(`[site-url] ${name} is set but is not a valid http(s) URL — ignoring it (length ${value.length}).`);
  }
  return DEFAULT_SITE_URL;
}
