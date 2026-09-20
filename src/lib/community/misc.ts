// Small pure helpers: trending score, upload keys, usernames.

import { randomBytes } from "node:crypto";

// ---- Trending ---------------------------------------------------------------

export interface TrendingInput {
  likeCount: number;
  commentCount: number;
  viewCount: number;
  createdAt: Date;
}

/**
 * "Hot" score: engagement over age, so a busy new post outranks a stale one
 * (a gravity-decay ranking like Hacker News/Reddit). Comments count more than
 * likes (a conversation is stronger than a tap); views count least and are
 * capped so a scripted refresh can't dominate. Pure — computed in memory over
 * a bounded recent candidate set, never in SQL.
 */
export function computeTrendingScore(p: TrendingInput, now: Date): number {
  const ageHours = Math.max(0, (now.getTime() - p.createdAt.getTime()) / 3_600_000);
  const engagement = p.likeCount * 3 + p.commentCount * 4 + Math.min(p.viewCount, 1000) * 0.05 + 1;
  return engagement / Math.pow(ageHours + 2, 1.4);
}

// ---- Upload keys -------------------------------------------------------------

/** Every Community upload lives under the uploader's own folder. */
export function communityKeyPrefix(userId: string): string {
  return `community/${userId}/`;
}

/** True only for a key under this member's own folder — the attach step must not trust a client-supplied string. */
export function isCommunityKey(userId: string, storageKey: string): boolean {
  if (storageKey.includes("..") || storageKey.includes("\\")) return false;
  const prefix = communityKeyPrefix(userId);
  return storageKey.startsWith(prefix) && storageKey.length > prefix.length;
}

// ---- Usernames ---------------------------------------------------------------

const USERNAME = /^[A-Za-z0-9_]{3,24}$/;
const RESERVED = new Set([
  "admin", "administrator", "moderator", "mod", "support", "staff", "system", "fxbothub", "fxbot", "official",
  "root", "null", "undefined", "everyone", "here", "api", "community", "settings", "new", "search",
]);

export function isValidUsername(name: string): boolean {
  return USERNAME.test(name) && !RESERVED.has(name.toLowerCase());
}

/** A handle candidate from a display name ("Jane Doe" -> "jane_doe"); never from an email address. */
export function usernameBase(displayName: string | null | undefined): string {
  const base = (displayName ?? "")
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 16);
  return base.length >= 3 ? base : "trader";
}

export function withSuffix(base: string): string {
  return `${base.slice(0, 18)}_${randomBytes(3).toString("hex")}`.slice(0, 24);
}
