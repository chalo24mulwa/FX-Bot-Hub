import { z } from "zod";
import type { CommunityContentStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { recordAuditLog } from "@/repositories/audit-log-repository";
import { normalizeContent } from "@/lib/community/content";
import { canRestrictTarget } from "@/lib/community/restrictions";
import { Actor, CommunityError, notifyCommunity } from "./core";

// Moderator/admin operations. Callers (server actions) have already required
// the `community:moderate` / `community:manage_categories` permission; every
// function here still loads its target by id, writes an append-only AuditLog
// row (that is the moderation history), and tells the affected member.

// Ids are opaque strings (cuids for user content, readable ids for the seeded
// categories), so validate their SHAPE — this also blocks anything odd before it reaches a query.
const cuid = z.string().regex(/^[A-Za-z0-9_-]{6,40}$/, "Invalid id");
const RANK: Record<string, number> = { USER: 0, SELLER: 1, AUTHOR: 1, MODERATOR: 2, ADMIN: 3, SUPER_ADMIN: 4 };

function cleanNote(note: string | undefined | null, required = false): string | null {
  const text = note ? normalizeContent(note).slice(0, 500) : "";
  if (required && text.length < 3) throw new CommunityError("Please give a short reason.");
  return text || null;
}

// ---- Content status -----------------------------------------------------------------

const STATUS_VERB: Record<CommunityContentStatus, string> = { PUBLISHED: "restored", HIDDEN: "hidden", REMOVED: "removed" };

export async function moderatePostStatus(actor: Actor, postId: string, status: CommunityContentStatus, note?: string) {
  const id = cuid.parse(postId);
  const post = await db.communityPost.findUnique({ where: { id }, select: { authorId: true, title: true, status: true } });
  if (!post) throw new CommunityError("Post not found.", 404);
  const reason = cleanNote(note, status !== "PUBLISHED");
  if (post.status === status) return;

  await db.communityPost.update({
    where: { id },
    data: { status, moderatedById: actor.id, moderatedAt: new Date(), moderationNote: status === "PUBLISHED" ? null : reason },
  });
  await recordAuditLog({ actorId: actor.id, action: `community.post.${STATUS_VERB[status]}`, entityType: "CommunityPost", entityId: id, metadata: { from: post.status, to: status, reason, title: post.title.slice(0, 120), authorId: post.authorId } });
  notifyCommunity({
    userId: post.authorId,
    actorId: actor.id,
    type: "COMMUNITY_MODERATION",
    title: `Your post "${post.title.slice(0, 60)}" was ${STATUS_VERB[status]} by a moderator`,
    body: reason ?? undefined,
    link: `/community/post/${id}`,
  });
  // Acting on a post closes the open reports against it.
  if (status !== "PUBLISHED") await closeReports({ postId: id }, actor, "RESOLVED", `Post ${STATUS_VERB[status]}`);
}

export async function moderateCommentStatus(actor: Actor, commentId: string, status: CommunityContentStatus, note?: string) {
  const id = cuid.parse(commentId);
  const comment = await db.communityComment.findUnique({ where: { id }, select: { authorId: true, status: true, postId: true } });
  if (!comment) throw new CommunityError("Comment not found.", 404);
  const reason = cleanNote(note, status !== "PUBLISHED");
  if (comment.status === status) return;

  // The post's comment count tracks PUBLISHED comments only.
  const delta = (status === "PUBLISHED" ? 1 : 0) - (comment.status === "PUBLISHED" ? 1 : 0);
  await db.$transaction([
    db.communityComment.update({
      where: { id },
      data: { status, moderatedById: actor.id, moderatedAt: new Date(), moderationNote: status === "PUBLISHED" ? null : reason },
    }),
    ...(delta !== 0 ? [db.communityPost.update({ where: { id: comment.postId }, data: { commentCount: { increment: delta } } })] : []),
  ]);
  await recordAuditLog({ actorId: actor.id, action: `community.comment.${STATUS_VERB[status]}`, entityType: "CommunityComment", entityId: id, metadata: { from: comment.status, to: status, reason, postId: comment.postId, authorId: comment.authorId } });
  notifyCommunity({
    userId: comment.authorId,
    actorId: actor.id,
    type: "COMMUNITY_MODERATION",
    title: `Your comment was ${STATUS_VERB[status]} by a moderator`,
    body: reason ?? undefined,
    link: `/community/post/${comment.postId}`,
  });
  if (status !== "PUBLISHED") await closeReports({ commentId: id }, actor, "RESOLVED", `Comment ${STATUS_VERB[status]}`);
}

export async function setPostFlag(actor: Actor, postId: string, flag: "isPinned" | "isFeatured" | "isLocked", value: boolean) {
  const id = cuid.parse(postId);
  const post = await db.communityPost.findUnique({ where: { id }, select: { authorId: true, title: true } });
  if (!post) throw new CommunityError("Post not found.", 404);
  await db.communityPost.update({ where: { id }, data: { [flag]: value, moderatedById: actor.id, moderatedAt: new Date() } });
  const label = { isPinned: "pin", isFeatured: "feature", isLocked: "lock" }[flag];
  await recordAuditLog({ actorId: actor.id, action: `community.post.${value ? label : `un${label}`}`, entityType: "CommunityPost", entityId: id, metadata: { title: post.title.slice(0, 120) } });
  if (value && flag === "isFeatured") {
    notifyCommunity({ userId: post.authorId, actorId: actor.id, type: "COMMUNITY_MODERATION", title: `Your post "${post.title.slice(0, 60)}" was featured`, link: `/community/post/${id}` });
  }
}

// ---- Reports ------------------------------------------------------------------------

async function closeReports(target: { postId?: string; commentId?: string }, actor: Actor, status: "RESOLVED" | "DISMISSED", note: string) {
  await db.communityReport.updateMany({
    where: { ...target, status: "OPEN" },
    data: { status, resolvedById: actor.id, resolvedAt: new Date(), resolutionNote: note },
  });
}

export async function resolveReport(actor: Actor, reportId: string, status: "RESOLVED" | "DISMISSED", note?: string) {
  const id = cuid.parse(reportId);
  const report = await db.communityReport.findUnique({ where: { id }, select: { status: true, postId: true, commentId: true } });
  if (!report) throw new CommunityError("Report not found.", 404);
  if (report.status !== "OPEN") return;
  const text = cleanNote(note) ?? (status === "DISMISSED" ? "Dismissed — no violation found" : "Reviewed");
  await db.communityReport.update({ where: { id }, data: { status, resolvedById: actor.id, resolvedAt: new Date(), resolutionNote: text } });
  await recordAuditLog({ actorId: actor.id, action: `community.report.${status.toLowerCase()}`, entityType: "CommunityReport", entityId: id, metadata: { note: text, postId: report.postId, commentId: report.commentId } });
}

// ---- Member restrictions ----------------------------------------------------------------

const restrictionSchema = z.object({
  userId: cuid,
  state: z.enum(["POSTING_SUSPENDED", "COMMUNITY_SUSPENDED", "BANNED"]),
  reason: z.string().max(1000),
  /** Whole hours; null/absent = no end (allowed for posting suspensions; BANNED is always permanent). */
  durationHours: z.number().int().min(1).max(24 * 365).nullable().optional(),
  /** Optional future start; defaults to now. */
  startsAt: z.coerce.date().optional().nullable(),
});

export async function restrictMember(actor: Actor, raw: unknown) {
  const input = restrictionSchema.parse(raw);
  const reason = cleanNote(input.reason, true)!;

  const target = await db.user.findUnique({ where: { id: input.userId }, select: { id: true, role: true, name: true } });
  if (!target) throw new CommunityError("Member not found.", 404);
  if (!canRestrictTarget(RANK[actor.role] ?? 0, RANK[target.role] ?? 0, target.id === actor.id)) {
    throw new CommunityError("You can't restrict yourself or a member with an equal or higher role.", 403);
  }

  const startsAt = input.startsAt && input.startsAt.getTime() > Date.now() ? input.startsAt : new Date();
  let endsAt: Date | null = null;
  if (input.state === "BANNED") {
    endsAt = null; // permanent by definition
  } else if (input.durationHours) {
    endsAt = new Date(startsAt.getTime() + input.durationHours * 3_600_000);
  } else if (input.state === "COMMUNITY_SUSPENDED") {
    throw new CommunityError("A Community suspension needs a duration. Use a ban for a permanent removal.");
  }

  const row = await db.communityRestriction.create({
    data: { userId: target.id, state: input.state, reason, startsAt, endsAt, issuedById: actor.id },
  });
  await recordAuditLog({
    actorId: actor.id,
    action: `community.user.${input.state.toLowerCase()}`,
    entityType: "CommunityUser",
    entityId: target.id,
    metadata: { restrictionId: row.id, reason, startsAt: startsAt.toISOString(), endsAt: endsAt?.toISOString() ?? null },
  });

  const what = { POSTING_SUSPENDED: "Your posting privileges in the Community were suspended", COMMUNITY_SUSPENDED: "Your Community access was suspended", BANNED: "You were permanently banned from posting in the Community" }[input.state];
  notifyCommunity({
    userId: target.id,
    actorId: actor.id,
    type: "COMMUNITY_MODERATION",
    title: `${what}${endsAt ? ` until ${endsAt.toISOString().slice(0, 10)}` : ""}`,
    body: `${reason}. Your FX Bot Hub account, purchases and downloads are not affected.`,
    link: "/community",
  });
  return row;
}

export async function liftRestriction(actor: Actor, restrictionId: string, note?: string) {
  const id = cuid.parse(restrictionId);
  const row = await db.communityRestriction.findUnique({ where: { id } });
  if (!row) throw new CommunityError("Restriction not found.", 404);
  if (row.liftedAt) return;
  const text = cleanNote(note);
  await db.communityRestriction.update({ where: { id }, data: { liftedAt: new Date(), liftedById: actor.id, liftNote: text } });
  await recordAuditLog({ actorId: actor.id, action: row.state === "BANNED" ? "community.user.unban" : "community.user.lift_restriction", entityType: "CommunityUser", entityId: row.userId, metadata: { restrictionId: id, state: row.state, note: text } });
  notifyCommunity({
    userId: row.userId,
    actorId: actor.id,
    type: "COMMUNITY_MODERATION",
    title: row.state === "BANNED" ? "Your Community ban was lifted" : "Your Community restriction was lifted",
    body: "You can post in the Community again.",
    link: "/community",
  });
}

// ---- Categories ----------------------------------------------------------------------------

const categorySchema = z.object({
  name: z.string().trim().min(2).max(40),
  description: z.string().trim().max(160).optional().nullable(),
  position: z.number().int().min(0).max(999).optional(),
});

function slugify(name: string): string {
  return name.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40);
}

export async function createCategory(actor: Actor, raw: unknown) {
  const input = categorySchema.parse(raw);
  const slug = slugify(input.name);
  if (slug.length < 2) throw new CommunityError("Choose a name with letters or numbers.");
  if (await db.communityCategory.findUnique({ where: { slug }, select: { id: true } })) throw new CommunityError("A category with that name already exists.");
  const last = await db.communityCategory.aggregate({ _max: { position: true } });
  const created = await db.communityCategory.create({
    data: { name: input.name, slug, description: input.description || null, position: input.position ?? (last._max.position ?? 0) + 1 },
  });
  await recordAuditLog({ actorId: actor.id, action: "community.category.create", entityType: "CommunityCategory", entityId: created.id, metadata: { name: created.name, slug } });
  return created;
}

export async function updateCategory(actor: Actor, categoryId: string, raw: unknown) {
  const id = cuid.parse(categoryId);
  const input = categorySchema.partial().extend({ isActive: z.boolean().optional() }).parse(raw);
  const existing = await db.communityCategory.findUnique({ where: { id } });
  if (!existing) throw new CommunityError("Category not found.", 404);
  // The slug is a stable URL — renaming never changes it.
  const updated = await db.communityCategory.update({
    where: { id },
    data: {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.description !== undefined ? { description: input.description || null } : {}),
      ...(input.position !== undefined ? { position: input.position } : {}),
      ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
    },
  });
  await recordAuditLog({ actorId: actor.id, action: "community.category.update", entityType: "CommunityCategory", entityId: id, metadata: JSON.parse(JSON.stringify(input)) });
  return updated;
}

