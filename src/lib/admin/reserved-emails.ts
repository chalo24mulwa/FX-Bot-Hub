/**
 * Addresses that public sign-up (email or Google) may never create. The first
 * administrator is provisioned out-of-band (scripts/provision-admin.ts), so an
 * ordinary visitor registering `admin@fxbothub.com` first would squat the
 * address and lock the real owner out of their own account.
 *
 * Add more with the optional `RESERVED_EMAILS` environment variable
 * (comma-separated); it only ever adds to this list.
 */
export const DEFAULT_RESERVED_EMAILS = ["admin@fxbothub.com"] as const;

export function reservedEmails(extra: string | undefined = process.env.RESERVED_EMAILS): string[] {
  const added = (extra ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return [...new Set([...DEFAULT_RESERVED_EMAILS, ...added])];
}

export function isReservedEmail(email: string, extra?: string): boolean {
  return reservedEmails(extra).includes(email.trim().toLowerCase());
}
