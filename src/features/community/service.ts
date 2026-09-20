import { z } from "zod";
import { db } from "@/lib/db";
import { storage } from "@/lib/storage";
import { UPLOAD_LIMITS } from "@/lib/storage/validate-upload";
import { LIKE_NOTIFY_MILESTONES, LIMITS, POSTING_LIMITS } from "@/config/community";
import { countLinks, extractMentions, normalizeContent, normalizeTags, normalizeTitle } from "@/lib/community/content";
import { normalizeTrade } from "@/lib/community/trade";
import { isCommunityKey, isValidUsername } from "@/lib/community/misc";
import { Actor, CommunityError, ensureUsername, isStaffRole, isUniqueViolation, notifyCommunity, requireCapability } from "./core";

// All Community mutations. This module is the trust boundary: server actions
// only parse/forward, and every function here (a) loads the target by id and
// checks ownership/visibility itself — a client-supplied id is never trusted —
// (b) re-checks the member's Community standing in the database, and
// (c) keeps the denormalised counters in step inside the same transaction.

// Ids are opaque strings (cuids for user content, readable ids for the seeded
// categories), so validate their SHAPE — this also blocks anything odd before it reaches a query.
const cuid = z.string().regex(/^[A-Za-z0-9_-]{6,40}$/, "Invalid id");

// ---- Limits (database-backed: the production host has no Redis) -------------

async function enforcePostLimits(userId: string) {
  const now = Date.now();
  const [hour, day] = await Promise.all([
    db.communityPost.count({ where: { authorId: userId, createdAt: { gte: new Date(now - 3_600_000) } } }),
    db.communityPost.count({ where: { authorId: userId, createdAt: { gte: new Date(now - 86_400_000) } } }),
  ]);
  if (hour >= POSTING_LIMITS.POSTS_PER_HOUR || day >= POSTING_LIMITS.POSTS_PER_DAY) {
    throw new CommunityError("You're posting too quickly. Please wait a while before creating another post.", 429);
  }
}

async function enforceCommentLimits(userId: string) {
  const now = Date.now();
  const [recent, day] = await Promise.all([
    db.communityComment.count({ where: { authorId: userId, createdAt: { gte: new Date(now - 600_000) } } }),
    db.communityComment.count({ where: { authorId: userId, createdAt: { gte: new Date(now - 86_400_000) } } }),
  ]);
  if (recent >= POSTING_LIMITS.COMMENTS_PER_10_MIN || day >= POSTING_LIMITS.COMMENTS_PER_DAY) {
    throw new CommunityError("You're commenting too quickly. Please slow down for a few minutes.", 429);
  }
}

// ---- Images -------------------------------------------------------------------

/** The client says "I uploaded this key" — check it's the member's own, really exists, and is a small image. */
async function verifyImage(userId: string, key: string) {
  if (!isCommunityKey(userId, key)) throw new CommunityError("One of the images isn't valid. Please upload it again.");
  let info;
  try {
    info = await storage.headObject(key);
  } catch {
    throw new CommunityError("Image storage isn't available right now. Try again later, or post without an image.", 503);
  }
  if (!info) throw new CommunityError("An uploaded image couldn't be found. Please upload it again.");
  if (info.sizeBytes <= 0 || info.sizeBytes > UPLOAD_LIMITS.image.maxBytes) throw new CommunityError("An image is too large (8 MB max).");
  if (!info.contentType || !(UPLOAD_LIMITS.image.contentTypes as readonly string[]).includes(info.contentType.toLowerCase())) {
    throw new CommunityError("Images must be PNG, JPG or WebP.");
  }
}

// ---- Posts --------------------------------------------------------------------

export const postInputSchema = z.object({
  type: z.enum(["DISCUSSION", "TRADING_IDEA", "SIGNAL", "QUESTION", "CHART"]),
  categoryId: cuid,
  title: z.string().max(400),
  content: z.string().max(LIMITS.POST_MAX * 2),
  instrument: z.string().max(40).optional().nullable(),
  direction: z.enum(["BUY", "SELL", "NEUTRAL"]).optional().nullable(),
  timeframe: z.string().max(8).optional().nullable(),
  entryPrice: z.string().max(40).optional().nullable(),
  stopLoss: z.string().max(40).optional().nullable(),
  takeProfit: z.string().max(40).optional().nullable(),
  tags: z.union([z.string().max(300), z.array(z.string().max(40)).max(20)]).optional(),
  images: z.array(z.string().max(300)).max(LIMITS.MAX_IMAGES).optional(),
});
export type PostInput = z.infer<typeof postInputSchema>;

/** Validated + normalised fields shared by create and edit. */
function preparePost(input: PostInput) {
  const title = normalizeTitle(input.title);
  const content = normalizeContent(input.content);
  if (title.length < LIMITS.TITLE_MIN) throw new CommunityError(`Give your post a title of at least ${LIMITS.TITLE_MIN} characters.`);
  if (title.length > LIMITS.TITLE_MAX) throw new CommunityError(`Titles can be at most ${LIMITS.TITLE_MAX} characters.`);
  if (content.length < LIMITS.POST_MIN) throw new CommunityError(`Write at least ${LIMITS.POST_MIN} characters in the post body.`);
  if (content.length > LIMITS.POST_MAX) throw new CommunityError(`The post body can be at most ${LIMITS.POST_MAX.toLocaleString()} characters.`);
  if (countLinks(`${title}\n${content}`) > LIMITS.MAX_LINKS_PER_POST) {
    throw new CommunityError(`Posts can contain at most ${LIMITS.MAX_LINKS_PER_POST} links.`);
  }
  const trade = normalizeTrade({
    type: input.type,
    instrument: input.instrument,
    direction: input.direction,
    timeframe: input.timeframe,
    entryPrice: input.entryPrice,
    stopLoss: input.stopLoss,
    takeProfit: input.takeProfit,
  });
  if (!trade.ok) throw new CommunityError(trade.error);
  return { title, content, trade: trade.value, tags: normalizeTags(input.tags, LIMITS.MAX_TAGS) };
}

async function notifyMentions(actor: Actor, actorUsername: string, text: string, link: string, where: string) {
  const names = extractMentions(text, LIMITS.MAX_MENTIONS);
  if (names.length === 0) return;
  const users = await db.profile.findMany({ where: { username: { in: names } }, select: { userId: true } });
  for (const u of users) {
    notifyCommunity({
      userId: u.userId,
      actorId: actor.id,
      type: "COMMUNITY_MENTION",
      title: `@${actorUsername} mentioned you ${where}`,
      body: normalizeContent(text).slice(0, 140),
      link,
    });
  }
}

export async function createPost(actor: Actor, raw: unknown): Promise<{ id: string }> {
  const input = postInputSchema.parse(raw);
  await requireCapability(actor.id, "canPost");

  const category = await db.communityCategory.findUnique({ where: { id: input.categoryId }, select: { id: true, isActive: true } });
  if (!category || !category.isActive) throw new CommunityError("Choose a valid category.");

  const { title, content, trade, tags } = preparePost(input);
  await enforcePostLimits(actor.id);

  const duplicate = await db.communityPost.findFirst({
    where: { authorId: actor.id, title: { equals: title, mode: "insensitive" }, createdAt: { gte: new Date(Date.now() - 86_400_000) }, status: { not: "REMOVED" } },
    select: { id: true },
  });
  if (duplicate) throw new CommunityError("You've already posted this recently.");

  const images = [...new Set(input.images ?? [])];
  for (const key of images) await verifyImage(actor.id, key);
  if (input.type === "CHART" && images.length === 0) throw new CommunityError("Add at least one chart image to a Chart / Image post.");

  const username = await ensureUsername(actor.id);

  const post = await db.$transaction(async (tx) => {
    const created = await tx.communityPost.create({
      data: {
        authorId: actor.id,
        categoryId: category.id,
        type: input.type,
        title,
        content,
        instrument: trade.instrument,
        direction: trade.direction,
        timeframe: trade.timeframe,
        entryPrice: trade.entryPrice,
        stopLoss: trade.stopLoss,
        takeProfit: trade.takeProfit,
        tags,
        attachments: { create: images.map((storageKey, position) => ({ storageKey, position })) },
      },
      select: { id: true },
    });
    await tx.communityPostFollow.create({ data: { userId: actor.id, postId: created.id } });
    return created;
  });

  void notifyMentions(actor, username, `${title}\n${content}`, `/community/post/${post.id}`, "in a post").catch(() => undefined);
  return post;
}

export async function updatePost(actor: Actor, postId: string, raw: unknown): Promise<{ id: string }> {
  const id = cuid.parse(postId);
  const input = postInputSchema.omit({ images: true }).parse(raw);
  await requireCapability(actor.id, "canPost");

  const existing = await db.communityPost.findUnique({ where: { id }, select: { authorId: true, status: true, type: true } });
  // Same message for "missing" and "not yours": don't reveal which ids exist.
  if (!existing || existing.authorId !== actor.id) throw new CommunityError("Post not found.", 404);
  if (existing.status !== "PUBLISHED") throw new CommunityError("This post can't be edited right now.", 403);

  const category = await db.communityCategory.findUnique({ where: { id: input.categoryId }, select: { id: true, isActive: true } });
  if (!category || !category.isActive) throw new CommunityError("Choose a valid category.");

  const { title, content, trade, tags } = preparePost({ ...input, type: existing.type });
  await db.communityPost.update({
    where: { id },
    data: {
      categoryId: category.id,
      title,
      content,
      instrument: trade.instrument,
      direction: trade.direction,
      timeframe: trade.timeframe,
      entryPrice: trade.entryPrice,
      stopLoss: trade.stopLoss,
      takeProfit: trade.takeProfit,
      tags,
      editedAt: new Date(),
    },
  });
  return { id };
}

/** Author deletes their own post. Soft delete — a moderator can still see and restore it. */
export async function deleteOwnPost(actor: Actor, postId: string): Promise<void> {
  const id = cuid.parse(postId);
  const existing = await db.communityPost.findUnique({ where: { id }, select: { authorId: true, status: true } });
  if (!existing || existing.authorId !== actor.id) throw new CommunityError("Post not found.", 404);
  if (existing.status === "REMOVED") return;
  await db.communityPost.update({
    where: { id },
    data: { status: "REMOVED", moderatedById: actor.id, moderatedAt: new Date(), moderationNote: "Deleted by the author" },
  });
}

// ---- Comments -----------------------------------------------------------------

const commentSchema = z.object({
  postId: cuid,
  parentId: cuid.optional().nullable(),
  content: z.string().max(LIMITS.COMMENT_MAX * 2),
});

function prepareComment(content: string) {
  const text = normalizeContent(content);
  if (text.length < LIMITS.COMMENT_MIN) throw new CommunityError("Write something first.");
  if (text.length > LIMITS.COMMENT_MAX) throw new CommunityError(`Comments can be at most ${LIMITS.COMMENT_MAX.toLocaleString()} characters.`);
  if (countLinks(text) > LIMITS.MAX_LINKS_PER_COMMENT) throw new CommunityError(`Comments can contain at most ${LIMITS.MAX_LINKS_PER_COMMENT} links.`);
  return text;
}

export async function createComment(actor: Actor, raw: unknown): Promise<{ id: string }> {
  const input = commentSchema.parse(raw);
  await requireCapability(actor.id, "canComment");

  const post = await db.communityPost.findUnique({ where: { id: input.postId }, select: { id: true, authorId: true, title: true, status: true, isLocked: true } });
  if (!post || post.status !== "PUBLISHED") throw new CommunityError("This post isn't available.", 404);
  if (post.isLocked && !isStaffRole(actor.role)) throw new CommunityError("This discussion is locked — no new comments.", 403);

  let parent: { id: string; authorId: string; depth: number; parentId: string | null } | null = null;
  if (input.parentId) {
    parent = await db.communityComment.findFirst({
      where: { id: input.parentId, postId: post.id, status: "PUBLISHED" },
      select: { id: true, authorId: true, depth: true, parentId: true },
    });
    if (!parent) throw new CommunityError("The comment you're replying to isn't available.", 404);
  }

  const text = prepareComment(input.content);
  await enforceCommentLimits(actor.id);
  const username = await ensureUsername(actor.id);

  // Keep threads readable: past the maximum depth a reply becomes a sibling.
  const attachToParent = parent && parent.depth < LIMITS.MAX_COMMENT_DEPTH ? parent : parent ? { id: parent.parentId, depth: parent.depth - 1 } : null;
  const depth = attachToParent ? attachToParent.depth + 1 : 0;

  const comment = await db.$transaction(async (tx) => {
    const created = await tx.communityComment.create({
      data: { postId: post.id, authorId: actor.id, parentId: attachToParent?.id ?? null, depth, content: text },
      select: { id: true },
    });
    await tx.communityPost.update({ where: { id: post.id }, data: { commentCount: { increment: 1 }, lastActivityAt: new Date() } });
    await tx.communityPostFollow.createMany({ data: [{ userId: actor.id, postId: post.id }], skipDuplicates: true });
    return created;
  });

  const link = `/community/post/${post.id}#c-${comment.id}`;
  void (async () => {
    const told = new Set<string>([actor.id]);
    const tell = (userId: string, type: "COMMUNITY_REPLY" | "COMMUNITY_ACTIVITY", title: string) => {
      if (told.has(userId)) return;
      told.add(userId);
      notifyCommunity({ userId, actorId: actor.id, type, title, body: text.slice(0, 140), link });
    };
    if (parent) tell(parent.authorId, "COMMUNITY_REPLY", `@${username} replied to your comment`);
    tell(post.authorId, "COMMUNITY_REPLY", `@${username} commented on your post "${post.title.slice(0, 60)}"`);
    const followers = await db.communityPostFollow.findMany({ where: { postId: post.id }, select: { userId: true }, take: 50 });
    for (const f of followers) tell(f.userId, "COMMUNITY_ACTIVITY", `New comment on "${post.title.slice(0, 60)}"`);
    await notifyMentions(actor, username, text, link, "in a comment");
  })().catch(() => undefined);

  return comment;
}

export async function updateComment(actor: Actor, commentId: string, content: string): Promise<void> {
  const id = cuid.parse(commentId);
  await requireCapability(actor.id, "canComment");
  const existing = await db.communityComment.findUnique({ where: { id }, select: { authorId: true, status: true } });
  if (!existing || existing.authorId !== actor.id) throw new CommunityError("Comment not found.", 404);
  if (existing.status !== "PUBLISHED") throw new CommunityError("This comment can't be edited.", 403);
  await db.communityComment.update({ where: { id }, data: { content: prepareComment(content), editedAt: new Date() } });
}

export async function deleteOwnComment(actor: Actor, commentId: string): Promise<void> {
  const id = cuid.parse(commentId);
  const existing = await db.communityComment.findUnique({ where: { id }, select: { authorId: true, status: true, postId: true } });
  if (!existing || existing.authorId !== actor.id) throw new CommunityError("Comment not found.", 404);
  if (existing.status !== "PUBLISHED") return;
  await db.$transaction([
    db.communityComment.update({
      where: { id },
      data: { status: "REMOVED", moderatedById: actor.id, moderatedAt: new Date(), moderationNote: "Deleted by the author" },
    }),
    db.communityPost.update({ where: { id: existing.postId }, data: { commentCount: { decrement: 1 } } }),
  ]);
}

// ---- Votes, bookmarks, follows -----------------------------------------------

export async function togglePostVote(actor: Actor, postId: string): Promise<{ liked: boolean; likeCount: number }> {
  const id = cuid.parse(postId);
  await requireCapability(actor.id, "canVote");
  const post = await db.communityPost.findUnique({ where: { id }, select: { authorId: true, status: true, title: true } });
  if (!post || post.status !== "PUBLISHED") throw new CommunityError("This post isn't available.", 404);
  if (post.authorId === actor.id) throw new CommunityError("You can't like your own post.");

  const result = await db.$transaction(async (tx) => {
    const existing = await tx.communityPostVote.findUnique({ where: { userId_postId: { userId: actor.id, postId: id } } });
    if (existing) {
      await tx.communityPostVote.delete({ where: { userId_postId: { userId: actor.id, postId: id } } });
      const updated = await tx.communityPost.update({ where: { id }, data: { likeCount: { decrement: 1 } }, select: { likeCount: true } });
      return { liked: false, likeCount: Math.max(0, updated.likeCount) };
    }
    await tx.communityPostVote.create({ data: { userId: actor.id, postId: id } });
    const updated = await tx.communityPost.update({ where: { id }, data: { likeCount: { increment: 1 } }, select: { likeCount: true } });
    return { liked: true, likeCount: updated.likeCount };
  }).catch(async (err) => {
    if (!isUniqueViolation(err)) throw err;
    // Two taps raced: report the state that won.
    const [vote, p] = await Promise.all([
      db.communityPostVote.findUnique({ where: { userId_postId: { userId: actor.id, postId: id } } }),
      db.communityPost.findUnique({ where: { id }, select: { likeCount: true } }),
    ]);
    return { liked: !!vote, likeCount: p?.likeCount ?? 0 };
  });

  // Told at milestones only — one ping per like would be noise (and a harassment vector).
  if (result.liked && LIKE_NOTIFY_MILESTONES.includes(result.likeCount)) {
    notifyCommunity({
      userId: post.authorId,
      actorId: actor.id,
      type: "COMMUNITY_ACTIVITY",
      title: `Your post "${post.title.slice(0, 60)}" has ${result.likeCount} like${result.likeCount === 1 ? "" : "s"}`,
      link: `/community/post/${id}`,
    });
  }
  return result;
}

export async function toggleCommentVote(actor: Actor, commentId: string): Promise<{ liked: boolean; likeCount: number }> {
  const id = cuid.parse(commentId);
  await requireCapability(actor.id, "canVote");
  const comment = await db.communityComment.findUnique({ where: { id }, select: { authorId: true, status: true } });
  if (!comment || comment.status !== "PUBLISHED") throw new CommunityError("This comment isn't available.", 404);
  if (comment.authorId === actor.id) throw new CommunityError("You can't like your own comment.");

  return db.$transaction(async (tx) => {
    const existing = await tx.communityCommentVote.findUnique({ where: { userId_commentId: { userId: actor.id, commentId: id } } });
    if (existing) {
      await tx.communityCommentVote.delete({ where: { userId_commentId: { userId: actor.id, commentId: id } } });
      const c = await tx.communityComment.update({ where: { id }, data: { likeCount: { decrement: 1 } }, select: { likeCount: true } });
      return { liked: false, likeCount: Math.max(0, c.likeCount) };
    }
    await tx.communityCommentVote.create({ data: { userId: actor.id, commentId: id } });
    const c = await tx.communityComment.update({ where: { id }, data: { likeCount: { increment: 1 } }, select: { likeCount: true } });
    return { liked: true, likeCount: c.likeCount };
  }).catch(async (err) => {
    if (!isUniqueViolation(err)) throw err;
    const [vote, c] = await Promise.all([
      db.communityCommentVote.findUnique({ where: { userId_commentId: { userId: actor.id, commentId: id } } }),
      db.communityComment.findUnique({ where: { id }, select: { likeCount: true } }),
    ]);
    return { liked: !!vote, likeCount: c?.likeCount ?? 0 };
  });
}

export async function toggleBookmark(actor: Actor, postId: string): Promise<{ bookmarked: boolean }> {
  const id = cuid.parse(postId);
  await requireCapability(actor.id, "canBookmark");
  const post = await db.communityPost.findUnique({ where: { id }, select: { status: true } });
  if (!post || post.status !== "PUBLISHED") throw new CommunityError("This post isn't available.", 404);

  return db.$transaction(async (tx) => {
    const existing = await tx.communityBookmark.findUnique({ where: { userId_postId: { userId: actor.id, postId: id } } });
    if (existing) {
      await tx.communityBookmark.delete({ where: { userId_postId: { userId: actor.id, postId: id } } });
      await tx.communityPost.update({ where: { id }, data: { bookmarkCount: { decrement: 1 } } });
      return { bookmarked: false };
    }
    await tx.communityBookmark.create({ data: { userId: actor.id, postId: id } });
    await tx.communityPost.update({ where: { id }, data: { bookmarkCount: { increment: 1 } } });
    return { bookmarked: true };
  }).catch(async (err) => {
    if (!isUniqueViolation(err)) throw err;
    return { bookmarked: !!(await db.communityBookmark.findUnique({ where: { userId_postId: { userId: actor.id, postId: id } } })) };
  });
}

export async function toggleFollow(actor: Actor, postId: string): Promise<{ following: boolean }> {
  const id = cuid.parse(postId);
  await requireCapability(actor.id, "canBookmark");
  const post = await db.communityPost.findUnique({ where: { id }, select: { status: true } });
  if (!post || post.status !== "PUBLISHED") throw new CommunityError("This post isn't available.", 404);
  const existing = await db.communityPostFollow.findUnique({ where: { userId_postId: { userId: actor.id, postId: id } } });
  if (existing) {
    await db.communityPostFollow.delete({ where: { userId_postId: { userId: actor.id, postId: id } } });
    return { following: false };
  }
  await db.communityPostFollow.createMany({ data: [{ userId: actor.id, postId: id }], skipDuplicates: true });
  return { following: true };
}

// ---- Reports ------------------------------------------------------------------

const reportSchema = z
  .object({
    postId: cuid.optional().nullable(),
    commentId: cuid.optional().nullable(),
    reason: z.enum(["SPAM", "SCAM", "HARASSMENT", "MISLEADING", "INAPPROPRIATE", "FAKE_CLAIM", "OTHER"]),
    details: z.string().max(LIMITS.REPORT_DETAILS_MAX * 2).optional().nullable(),
  })
  .refine((v) => !!v.postId !== !!v.commentId, { message: "Report a post or a comment." });

export async function reportContent(actor: Actor, raw: unknown): Promise<void> {
  const input = reportSchema.parse(raw);
  await requireCapability(actor.id, "canReport");

  const today = await db.communityReport.count({ where: { reporterId: actor.id, createdAt: { gte: new Date(Date.now() - 86_400_000) } } });
  if (today >= POSTING_LIMITS.REPORTS_PER_DAY) throw new CommunityError("You've reached today's report limit.", 429);

  const details = input.details ? normalizeContent(input.details).slice(0, LIMITS.REPORT_DETAILS_MAX) : null;
  if (input.reason === "OTHER" && !details) throw new CommunityError("Please describe the problem.");

  if (input.postId) {
    const post = await db.communityPost.findUnique({ where: { id: input.postId }, select: { authorId: true, status: true } });
    if (!post || post.status !== "PUBLISHED") throw new CommunityError("This post isn't available.", 404);
    if (post.authorId === actor.id) throw new CommunityError("You can't report your own post.");
  } else if (input.commentId) {
    const c = await db.communityComment.findUnique({ where: { id: input.commentId }, select: { authorId: true, status: true } });
    if (!c || c.status !== "PUBLISHED") throw new CommunityError("This comment isn't available.", 404);
    if (c.authorId === actor.id) throw new CommunityError("You can't report your own comment.");
  }

  try {
    await db.communityReport.create({
      data: { reporterId: actor.id, postId: input.postId ?? null, commentId: input.commentId ?? null, reason: input.reason, details },
    });
  } catch (err) {
    if (isUniqueViolation(err)) throw new CommunityError("You've already reported this. Thanks — our moderators will review it.");
    throw err;
  }
}

// ---- Views (in-memory de-dupe: one count per viewer per post per 30 minutes) -----

const recentViews = new Map<string, number>();
const VIEW_WINDOW_MS = 30 * 60_000;

export function recordPostView(postId: string, viewerKey: string): void {
  const now = Date.now();
  const key = `${postId}:${viewerKey}`;
  const last = recentViews.get(key);
  if (last && now - last < VIEW_WINDOW_MS) return;
  recentViews.set(key, now);
  if (recentViews.size > 5000) {
    for (const [k, t] of recentViews) if (now - t > VIEW_WINDOW_MS) recentViews.delete(k);
  }
  void db.communityPost.updateMany({ where: { id: postId, status: "PUBLISHED" }, data: { viewCount: { increment: 1 } } }).catch(() => undefined);
}

// ---- Profile ------------------------------------------------------------------

export async function updateCommunityProfile(actor: Actor, raw: { username?: string; bio?: string }): Promise<void> {
  const data: { username?: string; bio?: string | null } = {};
  if (raw.username !== undefined) {
    const username = raw.username.trim().toLowerCase();
    if (!isValidUsername(username)) throw new CommunityError("Usernames are 3–24 characters: letters, numbers and underscores.");
    data.username = username;
  }
  if (raw.bio !== undefined) {
    const bio = normalizeContent(raw.bio);
    if (bio.length > LIMITS.BIO_MAX) throw new CommunityError(`Your bio can be at most ${LIMITS.BIO_MAX} characters.`);
    data.bio = bio || null;
  }
  try {
    await db.profile.upsert({ where: { userId: actor.id }, update: data, create: { userId: actor.id, ...data } });
  } catch (err) {
    if (isUniqueViolation(err)) throw new CommunityError("That username is taken.");
    throw err;
  }
}
