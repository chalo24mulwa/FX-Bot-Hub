/**
 * The decision logic behind safe Google account linking in `src/lib/
 * auth.ts`'s `signIn` callback — split out as a pure function (no DB, no
 * Auth.js types) specifically so it's unit-testable in isolation, matching
 * this codebase's established pattern for security-relevant decisions
 * (see e.g. `shouldDispatchHighImpactAlert`, `detectFieldChanges`). The
 * callback itself only does I/O (look up the user, apply the decision);
 * every branch of *what to decide* lives here.
 */

export interface ExistingUserForLinking {
  id: string;
  bannedAt: Date | null;
  /** Every OAuth provider already linked to this user, e.g. ["google"]. */
  linkedProviders: string[];
}

export type GoogleLinkDecision =
  /** No existing user with this email (brand-new signup) — let Auth.js's
   * adapter create the User + Account normally, or the user is already
   * linked and this is just an ordinary repeat sign-in. */
  | { kind: "proceed" }
  /** An existing user owns this email, isn't banned, and Google
   * independently verified the requester controls it — link the accounts. */
  | { kind: "link"; userId: string }
  /** Refuse: either the existing account is banned, or Google reports the
   * email as unverified and it isn't already linked (an unverified claim
   * is not enough proof to attach a new sign-in method to someone else's
   * account). */
  | { kind: "reject" };

export function decideGoogleAccountLinking(
  existingUser: ExistingUserForLinking | null,
  googleEmailVerified: boolean | undefined
): GoogleLinkDecision {
  if (!existingUser) return { kind: "proceed" };
  if (existingUser.bannedAt) return { kind: "reject" };

  const alreadyLinked = existingUser.linkedProviders.includes("google");
  if (alreadyLinked) return { kind: "proceed" };

  return googleEmailVerified ? { kind: "link", userId: existingUser.id } : { kind: "reject" };
}
