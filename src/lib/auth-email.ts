import { db } from "@/lib/db";

/** Emails are compared and stored lowercase; only the mailbox casing differs between providers. */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * Finds a user by email without caring about letter case.
 *
 * `User.email` has a case-sensitive unique index and older rows keep whatever
 * casing the person typed at sign-up, while Google always returns lowercase. An
 * exact-match lookup therefore treated `Foo@Gmail.com` and `foo@gmail.com` as two
 * people — a Google sign-in would have created a *duplicate* account instead of
 * linking to the real one. The exact match goes first (it uses the unique index,
 * and is right for every normally-cased address); the case-insensitive fallback
 * only runs when that misses.
 */
export async function findUserByEmail(email: string) {
  const exact = await db.user.findUnique({ where: { email } });
  if (exact) return exact;
  return db.user.findFirst({ where: { email: { equals: email.trim(), mode: "insensitive" } } });
}
