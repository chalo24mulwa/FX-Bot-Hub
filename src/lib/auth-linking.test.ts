import { describe, expect, it } from "vitest";
import { decideGoogleAccountLinking, type ExistingUserForLinking } from "./auth-linking";

function existingUser(overrides: Partial<ExistingUserForLinking> = {}): ExistingUserForLinking {
  return { id: "user_1", bannedAt: null, linkedProviders: [], ...overrides };
}

describe("decideGoogleAccountLinking", () => {
  it("proceeds for a brand-new email (no existing user) when Google verified it", () => {
    expect(decideGoogleAccountLinking(null, true)).toEqual({ kind: "proceed" });
  });

  it("rejects a brand-new email Google has not verified (no squatting an address you may not own)", () => {
    expect(decideGoogleAccountLinking(null, false)).toEqual({ kind: "reject" });
    expect(decideGoogleAccountLinking(null, undefined)).toEqual({ kind: "reject" });
  });

  it("links a verified Google email to an existing, not-yet-linked account", () => {
    const decision = decideGoogleAccountLinking(existingUser({ id: "user_42" }), true);
    expect(decision).toEqual({ kind: "link", userId: "user_42" });
  });

  it("proceeds (does not re-link) when the account is already linked, regardless of email_verified", () => {
    const linked = existingUser({ linkedProviders: ["google"] });
    expect(decideGoogleAccountLinking(linked, true)).toEqual({ kind: "proceed" });
    expect(decideGoogleAccountLinking(linked, false)).toEqual({ kind: "proceed" });
  });

  it("rejects linking when Google reports the email as unverified and it isn't already linked", () => {
    expect(decideGoogleAccountLinking(existingUser(), false)).toEqual({ kind: "reject" });
    expect(decideGoogleAccountLinking(existingUser(), undefined)).toEqual({ kind: "reject" });
  });

  it("rejects a banned existing account even with a verified email", () => {
    const banned = existingUser({ bannedAt: new Date("2026-01-01") });
    expect(decideGoogleAccountLinking(banned, true)).toEqual({ kind: "reject" });
  });

  it("rejects a banned existing account that is already linked (banned still wins)", () => {
    const banned = existingUser({ bannedAt: new Date("2026-01-01"), linkedProviders: ["google"] });
    expect(decideGoogleAccountLinking(banned, true)).toEqual({ kind: "reject" });
  });

  it("never fabricates a link decision for an unrelated provider's email claim (only email_verified drives it, not identity of who's asking)", () => {
    // The function only ever sees a boolean, deliberately — the caller
    // (auth.ts) only invokes this for account.provider === "google", so
    // there is no "which provider" input to spoof here.
    const decision = decideGoogleAccountLinking(existingUser(), true);
    expect(decision.kind).toBe("link");
  });
});
