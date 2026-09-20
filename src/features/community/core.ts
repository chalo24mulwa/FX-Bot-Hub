import type { Prisma, UserRole } from "@prisma/client";
import { db } from "@/lib/db";
import { notify } from "@/lib/notifications/notify";
import { capabilitiesFor, resolveStanding, restrictionMessage, type CommunityCapabilities, type CommunityStanding } from "@/lib/community/restrictions";
import { isValidUsername, usernameBase, withSuffix } from "@/lib/community/misc";
import { roleAtLeast } from "@/lib/authorization/roles";

// Shared plumbing for the Community feature: errors, a member's standing,
// username assignment, and the notification helper. The one rule everything
// here enforces: Community restrictions are checked from the database on
// EVERY mutation — never from the (up to 60 s stale) session.

export interface Actor {
  id: string;
  role: UserRole;
}

/** An expected, user-presentable failure — server actions turn it into `{ ok: false, error }`. */
export class CommunityError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

export type ActionResult<T = object> = ({ ok: true } & T) | { ok: false; error: string };

export function isStaffRole(role: UserRole): boolean {
  return roleAtLeast(role, "MODERATOR");
}

export function isUniqueViolation(err: unknown): boolean {
  return typeof err === "object" && err !== null && (err as { code?: string }).code === "P2002";
}

export async function getStanding(userId: string): Promise<CommunityStanding> {
  const rows = await db.communityRestriction.findMany({
    where: { userId, liftedAt: null },
    select: { state: true, reason: true, startsAt: true, endsAt: true, liftedAt: true },
  });
  return resolveStanding(rows, new Date());
}

/** Throws the member-facing restriction message if they may not do `capability`. */
export async function requireCapability(userId: string, capability: keyof CommunityCapabilities): Promise<CommunityStanding> {
  const standing = await getStanding(userId);
  if (!capabilitiesFor(standing)[capability]) {
    throw new CommunityError(restrictionMessage(standing) ?? "You can't do that in the Community right now.", 403);
  }
  return standing;
}

/**
 * The member's public Community handle, created on first participation from
 * their display name (never from their email). Lowercase only, so mentions
 * and profile URLs are case-insensitive without a second index.
 */
export async function ensureUsername(userId: string): Promise<string> {
  const existing = await db.profile.findUnique({ where: { userId }, select: { username: true } });
  if (existing?.username) return existing.username;

  const user = await db.user.findUnique({ where: { id: userId }, select: { name: true } });
  const base = usernameBase(user?.name);
  for (let attempt = 0; attempt < 6; attempt++) {
    const candidate = attempt === 0 && isValidUsername(base) ? base : withSuffix(base);
    try {
      await db.profile.upsert({
        where: { userId },
        update: { username: candidate },
        create: { userId, username: candidate, displayName: user?.name ?? null },
      });
      return candidate;
    } catch (err) {
      if (isUniqueViolation(err)) continue; // someone holds it — try another
      throw err;
    }
  }
  throw new CommunityError("Couldn't set up your Community username. Please try again.", 500);
}

/** Fire-and-forget in-app notification; never on the critical path, never to yourself. */
export function notifyCommunity(input: {
  userId: string;
  actorId?: string;
  type: "COMMUNITY_REPLY" | "COMMUNITY_MENTION" | "COMMUNITY_ACTIVITY" | "COMMUNITY_MODERATION";
  title: string;
  body?: string;
  link: string;
}): void {
  if (input.actorId && input.actorId === input.userId) return;
  void notify({ userId: input.userId, type: input.type, title: input.title, body: input.body, link: input.link, channels: ["IN_APP"] }).catch(
    () => undefined
  );
}

export const authorSelect = {
  id: true,
  name: true,
  image: true,
  role: true,
  createdAt: true,
  profile: { select: { username: true, displayName: true, avatarUrl: true, bio: true } },
} satisfies Prisma.UserSelect;

export interface PublicAuthor {
  id: string;
  username: string | null;
  displayName: string;
  avatarUrl: string | null;
  isStaff: boolean;
}

type AuthorRow = Prisma.UserGetPayload<{ select: typeof authorSelect }>;

/** Only public fields ever leave the server — never email, password hash, or ban state. */
export function toPublicAuthor(u: AuthorRow): PublicAuthor {
  const username = u.profile?.username ?? null;
  return {
    id: u.id,
    username,
    displayName: u.profile?.displayName ?? u.name ?? username ?? "Member",
    avatarUrl: u.profile?.avatarUrl ?? u.image ?? null,
    isStaff: isStaffRole(u.role),
  };
}
