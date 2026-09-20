import type { CommunityRestrictionState } from "@prisma/client";

// A member's Community standing, derived from CommunityRestriction rows.
// "ACTIVE" is simply the absence of an active restriction. This is entirely
// separate from User.bannedAt (the site-wide ban): a restricted member keeps
// their FX Bot Hub account, marketplace access and downloads. Pure module.

export interface RestrictionRow {
  state: CommunityRestrictionState;
  reason: string;
  startsAt: Date;
  endsAt: Date | null;
  liftedAt: Date | null;
}

export type CommunityState = "ACTIVE" | CommunityRestrictionState;

export interface CommunityStanding {
  state: CommunityState;
  restriction: RestrictionRow | null;
}

// Most severe first.
const SEVERITY: CommunityRestrictionState[] = ["BANNED", "COMMUNITY_SUSPENDED", "POSTING_SUSPENDED"];

export function isRestrictionActive(row: RestrictionRow, now: Date): boolean {
  if (row.liftedAt) return false;
  if (row.startsAt.getTime() > now.getTime()) return false;
  return row.endsAt === null || row.endsAt.getTime() > now.getTime();
}

export function resolveStanding(rows: RestrictionRow[], now: Date): CommunityStanding {
  const active = rows.filter((r) => isRestrictionActive(r, now));
  for (const state of SEVERITY) {
    const match = active.filter((r) => r.state === state).sort((a, b) => (b.endsAt?.getTime() ?? Infinity) - (a.endsAt?.getTime() ?? Infinity))[0];
    if (match) return { state, restriction: match };
  }
  return { state: "ACTIVE", restriction: null };
}

export interface CommunityCapabilities {
  canPost: boolean;
  canComment: boolean;
  canVote: boolean;
  canReport: boolean;
  /** Bookmarks and follows are private to the member, so they stay available while read-only. */
  canBookmark: boolean;
}

export function capabilitiesFor(standing: CommunityStanding): CommunityCapabilities {
  switch (standing.state) {
    case "ACTIVE":
      return { canPost: true, canComment: true, canVote: true, canReport: true, canBookmark: true };
    case "POSTING_SUSPENDED":
      return { canPost: false, canComment: false, canVote: true, canReport: true, canBookmark: true };
    case "COMMUNITY_SUSPENDED":
    case "BANNED":
      return { canPost: false, canComment: false, canVote: false, canReport: false, canBookmark: true };
  }
}

const dateFormat = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

/** The message a restricted member sees instead of a posting form. */
export function restrictionMessage(standing: CommunityStanding): string | null {
  const r = standing.restriction;
  if (!r) return null;
  const reasonText = r.reason?.trim();
  const reason = reasonText ? ` Reason: ${reasonText}${/[.!?]$/.test(reasonText) ? "" : "."}` : "";
  const until = r.endsAt ? ` until ${dateFormat.format(r.endsAt)} (UTC)` : "";
  switch (standing.state) {
    case "POSTING_SUSPENDED":
      return `Your posting privileges in the Community are suspended${until}.${reason} You can still read, like and save posts, and your FX Bot Hub account is unaffected.`;
    case "COMMUNITY_SUSPENDED":
      return `Your Community access is suspended${until}.${reason} You can still read the Community, and your FX Bot Hub account is unaffected.`;
    case "BANNED":
      return `You have been permanently banned from posting in the Community.${reason} You can still read the Community, and your FX Bot Hub account, purchases and downloads are unaffected.`;
    default:
      return null;
  }
}

/** Moderators can't restrict themselves or anyone of equal/higher rank. */
export function canRestrictTarget(actorRank: number, targetRank: number, sameUser: boolean): boolean {
  return !sameUser && targetRank < actorRank;
}
