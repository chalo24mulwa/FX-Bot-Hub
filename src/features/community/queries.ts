import type { CommunityContentStatus, CommunityPostType, Prisma, TradeDirection } from "@prisma/client";
import { db } from "@/lib/db";
import { PAGE_SIZE, type FeedSort } from "@/config/community";
import { toPreview } from "@/lib/community/content";
import { computeTrendingScore } from "@/lib/community/misc";
import { normalizeInstrument } from "@/lib/community/trade";
import { authorSelect, isStaffRole, toPublicAuthor, type PublicAuthor } from "./core";

// Community reads. Public queries only ever return PUBLISHED content and
// public author fields (see toPublicAuthor — no email, no ban state).
// Hidden/removed content is visible solely to its author and to staff.

export interface Viewer {
  id: string;
  role: import("@prisma/client").UserRole;
}

export interface PostListItem {
  id: string;
  type: CommunityPostType;
  title: string;
  preview: string;
  author: PublicAuthor;
  category: { slug: string; name: string };
  createdAt: Date;
  editedAt: Date | null;
  instrument: string | null;
  direction: TradeDirection | null;
  timeframe: string | null;
  entryPrice: string | null;
  stopLoss: string | null;
  takeProfit: string | null;
  tags: string[];
  images: string[];
  status: CommunityContentStatus;
  isPinned: boolean;
  isFeatured: boolean;
  isLocked: boolean;
  likeCount: number;
  commentCount: number;
  viewCount: number;
  liked: boolean;
  bookmarked: boolean;
}

const postListSelect = {
  id: true,
  type: true,
  title: true,
  content: true,
  createdAt: true,
  editedAt: true,
  instrument: true,
  direction: true,
  timeframe: true,
  entryPrice: true,
  stopLoss: true,
  takeProfit: true,
  tags: true,
  status: true,
  isPinned: true,
  isFeatured: true,
  isLocked: true,
  likeCount: true,
  commentCount: true,
  viewCount: true,
  author: { select: authorSelect },
  category: { select: { slug: true, name: true } },
  attachments: { orderBy: { position: "asc" as const }, select: { storageKey: true } },
} satisfies Prisma.CommunityPostSelect;

type PostRow = Prisma.CommunityPostGetPayload<{ select: typeof postListSelect }>;

async function withViewerFlags(rows: PostRow[], viewer: Viewer | null | undefined): Promise<PostListItem[]> {
  const ids = rows.map((r) => r.id);
  const [votes, bookmarks] =
    viewer && ids.length
      ? await Promise.all([
          db.communityPostVote.findMany({ where: { userId: viewer.id, postId: { in: ids } }, select: { postId: true } }),
          db.communityBookmark.findMany({ where: { userId: viewer.id, postId: { in: ids } }, select: { postId: true } }),
        ])
      : [[], []];
  const liked = new Set(votes.map((v) => v.postId));
  const saved = new Set(bookmarks.map((b) => b.postId));

  return rows.map((r) => ({
    id: r.id,
    type: r.type,
    title: r.title,
    preview: toPreview(r.content, 260),
    author: toPublicAuthor(r.author),
    category: r.category,
    createdAt: r.createdAt,
    editedAt: r.editedAt,
    instrument: r.instrument,
    direction: r.direction,
    timeframe: r.timeframe,
    entryPrice: r.entryPrice,
    stopLoss: r.stopLoss,
    takeProfit: r.takeProfit,
    tags: r.tags,
    images: r.attachments.map((a) => a.storageKey),
    status: r.status,
    isPinned: r.isPinned,
    isFeatured: r.isFeatured,
    isLocked: r.isLocked,
    likeCount: r.likeCount,
    commentCount: r.commentCount,
    viewCount: r.viewCount,
    liked: liked.has(r.id),
    bookmarked: saved.has(r.id),
  }));
}

// ---- Feed ------------------------------------------------------------------------

export interface FeedQuery {
  sort?: FeedSort;
  type?: CommunityPostType;
  /** Several types at once (a profile's "Trading ideas" tab). */
  types?: CommunityPostType[];
  categorySlugs?: string[];
  q?: string;
  tag?: string;
  instrument?: string;
  authorId?: string;
  bookmarkedBy?: string;
  page?: number;
  pageSize?: number;
}

/**
 * Prisma's `contains` doesn't escape LIKE wildcards, so a member searching for
 * "%_%" would match every row. (It is parameterised — not injection — but the
 * semantics are wrong.) Wildcard characters are simply dropped from search terms.
 */
const cleanLike = (s: string) => s.replace(/[%_\\]+/g, " ").replace(/\s+/g, " ").trim();

const TRENDING_WINDOW_DAYS = 14;
const TRENDING_CANDIDATES = 300;

function buildWhere(query: FeedQuery): Prisma.CommunityPostWhereInput {
  const rawQuery = query.q?.trim().slice(0, 80);
  const q = rawQuery ? cleanLike(rawQuery) : undefined;
  const tagQuery = q?.replace(/^#/, "").toLowerCase();
  return {
    // A query made only of wildcard characters matches nothing (rather than everything).
    ...(rawQuery && !q ? { id: "__no_match__" } : {}),
    status: "PUBLISHED",
    ...(query.type ? { type: query.type } : {}),
    ...(query.types?.length ? { type: { in: query.types } } : {}),
    ...(query.categorySlugs?.length ? { category: { slug: { in: query.categorySlugs } } } : {}),
    ...(query.authorId ? { authorId: query.authorId } : {}),
    ...(query.tag ? { tags: { has: query.tag.toLowerCase() } } : {}),
    ...(query.instrument ? { instrument: normalizeInstrument(query.instrument) } : {}),
    ...(query.bookmarkedBy ? { bookmarks: { some: { userId: query.bookmarkedBy } } } : {}),
    ...(q
      ? {
          OR: [
            { title: { contains: q, mode: "insensitive" } },
            { content: { contains: q, mode: "insensitive" } },
            { tags: { has: tagQuery! } },
            { instrument: normalizeInstrument(q) },
            { author: { profile: { username: { contains: q.replace(/^@/, "").toLowerCase() } } } },
          ],
        }
      : {}),
  };
}

export async function listPosts(query: FeedQuery, viewer?: Viewer | null): Promise<{ items: PostListItem[]; total: number; page: number; pageSize: number }> {
  const page = Math.max(1, query.page ?? 1);
  const pageSize = query.pageSize ?? PAGE_SIZE;
  const sort = query.sort ?? "latest";
  const where = buildWhere(query);

  if (sort === "trending") {
    // Bounded recent candidate set, ranked in memory (pure score, unit-tested).
    const since = new Date(Date.now() - TRENDING_WINDOW_DAYS * 86_400_000);
    const candidates = await db.communityPost.findMany({
      where: { ...where, createdAt: { gte: since } },
      select: { ...postListSelect },
      orderBy: { createdAt: "desc" },
      take: TRENDING_CANDIDATES,
    });
    const now = new Date();
    const ranked = candidates
      .map((c) => ({ c, score: computeTrendingScore(c, now) }))
      .sort((a, b) => b.score - a.score)
      .map((x) => x.c);
    const slice = ranked.slice((page - 1) * pageSize, page * pageSize);
    return { items: await withViewerFlags(slice, viewer), total: ranked.length, page, pageSize };
  }

  const orderBy: Prisma.CommunityPostOrderByWithRelationInput[] =
    sort === "discussed"
      ? [{ commentCount: "desc" }, { createdAt: "desc" }]
      : sort === "liked"
        ? [{ likeCount: "desc" }, { createdAt: "desc" }]
        : [{ isPinned: "desc" }, { createdAt: "desc" }];

  const [rows, total] = await Promise.all([
    db.communityPost.findMany({ where, select: postListSelect, orderBy, skip: (page - 1) * pageSize, take: pageSize }),
    db.communityPost.count({ where }),
  ]);
  return { items: await withViewerFlags(rows, viewer), total, page, pageSize };
}

// ---- Post detail -------------------------------------------------------------------

export interface PostDetail extends PostListItem {
  content: string;
  moderationNote: string | null;
  bookmarkCount: number;
  following: boolean;
  isAuthor: boolean;
}

export async function getPostDetail(id: string, viewer?: Viewer | null): Promise<PostDetail | null> {
  const row = await db.communityPost.findUnique({
    where: { id },
    select: { ...postListSelect, authorId: true, bookmarkCount: true, moderationNote: true },
  });
  if (!row) return null;
  const isAuthor = !!viewer && viewer.id === row.authorId;
  const isStaff = !!viewer && isStaffRole(viewer.role);
  // Hidden/removed posts exist only for their author and for staff.
  if (row.status !== "PUBLISHED" && !isAuthor && !isStaff) return null;

  const [item] = await withViewerFlags([row], viewer);
  const following = viewer ? !!(await db.communityPostFollow.findUnique({ where: { userId_postId: { userId: viewer.id, postId: id } }, select: { postId: true } })) : false;
  return { ...item, content: row.content, moderationNote: isAuthor || isStaff ? row.moderationNote : null, bookmarkCount: row.bookmarkCount, following, isAuthor };
}

export interface CommentNode {
  id: string;
  author: PublicAuthor;
  content: string;
  status: CommunityContentStatus;
  depth: number;
  likeCount: number;
  liked: boolean;
  createdAt: Date;
  editedAt: Date | null;
  isOwn: boolean;
  replies: CommentNode[];
}

/** All comments for a post as a tree. Removed/hidden comments with replies stay as a placeholder so the thread still reads. */
export async function getCommentTree(postId: string, viewer?: Viewer | null): Promise<CommentNode[]> {
  const rows = await db.communityComment.findMany({
    where: { postId },
    orderBy: { createdAt: "asc" },
    take: 600,
    select: {
      id: true, parentId: true, content: true, status: true, depth: true, likeCount: true, createdAt: true, editedAt: true, authorId: true,
      author: { select: authorSelect },
    },
  });
  const votes = viewer && rows.length
    ? await db.communityCommentVote.findMany({ where: { userId: viewer.id, commentId: { in: rows.map((r) => r.id) } }, select: { commentId: true } })
    : [];
  const liked = new Set(votes.map((v) => v.commentId));
  const isStaff = !!viewer && isStaffRole(viewer.role);

  const nodes = new Map<string, CommentNode>();
  for (const r of rows) {
    const visible = r.status === "PUBLISHED" || isStaff;
    nodes.set(r.id, {
      id: r.id,
      author: toPublicAuthor(r.author),
      content: visible ? r.content : "",
      status: r.status,
      depth: r.depth,
      likeCount: r.likeCount,
      liked: liked.has(r.id),
      createdAt: r.createdAt,
      editedAt: r.editedAt,
      isOwn: !!viewer && viewer.id === r.authorId,
      replies: [],
    });
  }
  const roots: CommentNode[] = [];
  for (const r of rows) {
    const node = nodes.get(r.id)!;
    const parent = r.parentId ? nodes.get(r.parentId) : null;
    (parent ? parent.replies : roots).push(node);
  }
  const prune = (list: CommentNode[]): CommentNode[] =>
    list
      .map((n) => ({ ...n, replies: prune(n.replies) }))
      .filter((n) => n.status === "PUBLISHED" || isStaff || n.replies.length > 0);
  return prune(roots);
}

// ---- Categories & sidebars -----------------------------------------------------------

export async function listCategories(options: { includeInactive?: boolean } = {}) {
  const [cats, counts] = await Promise.all([
    db.communityCategory.findMany({
      where: options.includeInactive ? {} : { isActive: true },
      orderBy: [{ position: "asc" }, { name: "asc" }],
    }),
    db.communityPost.groupBy({ by: ["categoryId"], where: { status: "PUBLISHED" }, _count: true }),
  ]);
  const byId = new Map(counts.map((c) => [c.categoryId, c._count]));
  return cats.map((c) => ({ ...c, postCount: byId.get(c.id) ?? 0 }));
}

export interface SidebarData {
  trending: PostListItem[];
  popular: PostListItem[];
  featured: PostListItem[];
  activeMembers: { author: PublicAuthor; activity: number }[];
  hotTopics: { label: string; href: string; count: number }[];
}

export async function getSidebarData(viewer?: Viewer | null): Promise<SidebarData> {
  const since14 = new Date(Date.now() - 14 * 86_400_000);
  const since30 = new Date(Date.now() - 30 * 86_400_000);

  const [trending, popular, featuredRows, postAuthors, commentAuthors, tagRows, instrumentRows] = await Promise.all([
    listPosts({ sort: "trending", pageSize: 5 }, viewer),
    db.communityPost.findMany({ where: { status: "PUBLISHED", createdAt: { gte: since30 }, likeCount: { gt: 0 } }, select: postListSelect, orderBy: [{ likeCount: "desc" }, { createdAt: "desc" }], take: 5 }),
    db.communityPost.findMany({ where: { status: "PUBLISHED", isFeatured: true }, select: postListSelect, orderBy: { createdAt: "desc" }, take: 3 }),
    db.communityPost.groupBy({ by: ["authorId"], where: { status: "PUBLISHED", createdAt: { gte: since14 } }, _count: true, orderBy: { _count: { authorId: "desc" } }, take: 8 }),
    db.communityComment.groupBy({ by: ["authorId"], where: { status: "PUBLISHED", createdAt: { gte: since14 } }, _count: true, orderBy: { _count: { authorId: "desc" } }, take: 8 }),
    // Parameter-free raw query: no user input reaches it.
    db.$queryRaw<{ tag: string; n: bigint }[]>`
      SELECT tag, COUNT(*) AS n FROM (SELECT unnest("tags") AS tag FROM "community_posts" WHERE "status" = 'PUBLISHED' AND "createdAt" >= ${since14}) t
      GROUP BY tag ORDER BY n DESC, tag ASC LIMIT 8`,
    db.communityPost.groupBy({ by: ["instrument"], where: { status: "PUBLISHED", createdAt: { gte: since14 }, instrument: { not: null } }, _count: true, orderBy: { _count: { instrument: "desc" } }, take: 6 }),
  ]);

  const activity = new Map<string, number>();
  for (const g of postAuthors) activity.set(g.authorId, (activity.get(g.authorId) ?? 0) + g._count * 3);
  for (const g of commentAuthors) activity.set(g.authorId, (activity.get(g.authorId) ?? 0) + g._count);
  const topIds = [...activity.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
  const users = topIds.length ? await db.user.findMany({ where: { id: { in: topIds.map(([id]) => id) } }, select: authorSelect }) : [];
  const userById = new Map(users.map((u) => [u.id, u]));

  return {
    trending: trending.items,
    popular: await withViewerFlags(popular, viewer),
    featured: await withViewerFlags(featuredRows, viewer),
    activeMembers: topIds.flatMap(([id, n]) => (userById.get(id) ? [{ author: toPublicAuthor(userById.get(id)!), activity: n }] : [])),
    hotTopics: [
      ...instrumentRows.map((r) => ({ label: r.instrument as string, href: `/community?instrument=${encodeURIComponent(r.instrument as string)}`, count: r._count })),
      ...tagRows.map((r) => ({ label: `#${r.tag}`, href: `/community?tag=${encodeURIComponent(r.tag)}`, count: Number(r.n) })),
    ].sort((a, b) => b.count - a.count).slice(0, 10),
  };
}

// ---- Search ---------------------------------------------------------------------------

const escapeLike = (s: string) => s.replace(/[\\%_]/g, (m) => `\\${m}`);

export async function searchCommunity(rawQuery: string, viewer?: Viewer | null) {
  const q = cleanLike(rawQuery.trim().slice(0, 80));
  if (q.length < 2) return { posts: [] as PostListItem[], users: [], categories: [], tags: [] as { tag: string; count: number }[] };
  const name = q.replace(/^[@#]/, "");

  const [posts, users, categories, tags] = await Promise.all([
    listPosts({ q, sort: "latest", pageSize: 10 }, viewer),
    db.profile.findMany({
      where: { username: { not: null }, OR: [{ username: { contains: name.toLowerCase() } }, { displayName: { contains: name, mode: "insensitive" } }] },
      select: { username: true, displayName: true, avatarUrl: true, user: { select: { id: true, name: true, image: true, role: true, createdAt: true, profile: { select: { username: true, displayName: true, avatarUrl: true, bio: true } } } } },
      take: 8,
    }),
    db.communityCategory.findMany({ where: { isActive: true, name: { contains: name, mode: "insensitive" } }, orderBy: { position: "asc" }, take: 8 }),
    // Tagged template => parameterised; the LIKE pattern is escaped so '%'/'_' in the query stay literal.
    db.$queryRaw<{ tag: string; n: bigint }[]>`
      SELECT tag, COUNT(*) AS n FROM (SELECT unnest("tags") AS tag FROM "community_posts" WHERE "status" = 'PUBLISHED') t
      WHERE tag LIKE ${`%${escapeLike(name.toLowerCase())}%`} GROUP BY tag ORDER BY n DESC LIMIT 8`,
  ]);

  return {
    posts: posts.items,
    users: users.map((p) => toPublicAuthor(p.user)),
    categories,
    tags: tags.map((t) => ({ tag: t.tag, count: Number(t.n) })),
  };
}

// ---- Profile ---------------------------------------------------------------------------

export async function getCommunityProfile(username: string) {
  const profile = await db.profile.findUnique({
    where: { username: username.toLowerCase() },
    select: { bio: true, userId: true, user: { select: authorSelect } },
  });
  if (!profile) return null;
  const userId = profile.userId;

  const [postCount, ideaCount, commentCount, postLikes, commentLikes] = await Promise.all([
    db.communityPost.count({ where: { authorId: userId, status: "PUBLISHED" } }),
    db.communityPost.count({ where: { authorId: userId, status: "PUBLISHED", type: { in: ["TRADING_IDEA", "SIGNAL", "CHART"] } } }),
    db.communityComment.count({ where: { authorId: userId, status: "PUBLISHED" } }),
    db.communityPost.aggregate({ where: { authorId: userId, status: "PUBLISHED" }, _sum: { likeCount: true } }),
    db.communityComment.aggregate({ where: { authorId: userId, status: "PUBLISHED" }, _sum: { likeCount: true } }),
  ]);

  return {
    userId,
    author: toPublicAuthor(profile.user),
    bio: profile.bio,
    joinedAt: profile.user.createdAt,
    stats: {
      posts: postCount,
      ideas: ideaCount,
      comments: commentCount,
      // Reputation = likes earned on published posts and comments (own likes aren't possible).
      reputation: (postLikes._sum.likeCount ?? 0) + (commentLikes._sum.likeCount ?? 0),
    },
  };
}

export async function listRecentComments(userId: string, take = 10) {
  const rows = await db.communityComment.findMany({
    where: { authorId: userId, status: "PUBLISHED", post: { status: "PUBLISHED" } },
    orderBy: { createdAt: "desc" },
    take,
    select: { id: true, content: true, createdAt: true, likeCount: true, post: { select: { id: true, title: true } } },
  });
  return rows.map((r) => ({ ...r, preview: toPreview(r.content, 200) }));
}

// ---- Admin reads -------------------------------------------------------------------------

export async function adminListPosts(params: { q?: string; status?: CommunityContentStatus; page: number; pageSize?: number }) {
  const pageSize = params.pageSize ?? 20;
  const q = params.q ? cleanLike(params.q.trim().slice(0, 80)) || undefined : undefined;
  const where: Prisma.CommunityPostWhereInput = {
    ...(params.status ? { status: params.status } : {}),
    ...(q
      ? {
          OR: [
            { title: { contains: q, mode: "insensitive" } },
            { author: { name: { contains: q, mode: "insensitive" } } },
            { author: { profile: { username: { contains: q.toLowerCase() } } } },
          ],
        }
      : {}),
  };
  const [rows, total] = await Promise.all([
    db.communityPost.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (params.page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true, title: true, type: true, status: true, isPinned: true, isFeatured: true, isLocked: true, createdAt: true, likeCount: true, commentCount: true,
        moderationNote: true, category: { select: { name: true } }, author: { select: authorSelect },
        _count: { select: { reports: { where: { status: "OPEN" } } } },
      },
    }),
    db.communityPost.count({ where }),
  ]);
  return { items: rows.map((r) => ({ ...r, author: toPublicAuthor(r.author), openReports: r._count.reports })), total, pageSize };
}

export async function adminListReports(params: { status: "OPEN" | "RESOLVED" | "DISMISSED"; page: number; pageSize?: number }) {
  const pageSize = params.pageSize ?? 20;
  const [rows, total] = await Promise.all([
    db.communityReport.findMany({
      where: { status: params.status },
      orderBy: { createdAt: params.status === "OPEN" ? "asc" : "desc" },
      skip: (params.page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true, reason: true, details: true, status: true, createdAt: true, resolutionNote: true, resolvedAt: true,
        reporter: { select: authorSelect },
        post: { select: { id: true, title: true, content: true, status: true, author: { select: authorSelect } } },
        comment: { select: { id: true, content: true, status: true, postId: true, author: { select: authorSelect } } },
      },
    }),
    db.communityReport.count({ where: { status: params.status } }),
  ]);
  return {
    total,
    pageSize,
    items: rows.map((r) => ({
      id: r.id,
      reason: r.reason,
      details: r.details,
      status: r.status,
      createdAt: r.createdAt,
      resolutionNote: r.resolutionNote,
      reporter: toPublicAuthor(r.reporter),
      target: r.post
        ? { kind: "post" as const, id: r.post.id, postId: r.post.id, status: r.post.status, title: r.post.title, preview: toPreview(r.post.content, 220), author: toPublicAuthor(r.post.author), authorUserId: r.post.author.id }
        : r.comment
          ? { kind: "comment" as const, id: r.comment.id, postId: r.comment.postId, status: r.comment.status, title: null, preview: toPreview(r.comment.content, 220), author: toPublicAuthor(r.comment.author), authorUserId: r.comment.author.id }
          : null,
    })),
  };
}

export async function adminSearchUsers(q: string) {
  const term = cleanLike(q.trim().slice(0, 80));
  if (term.length < 2) return [];
  const users = await db.user.findMany({
    where: {
      OR: [
        { name: { contains: term, mode: "insensitive" } },
        { email: { contains: term, mode: "insensitive" } },
        { profile: { username: { contains: term.toLowerCase() } } },
      ],
    },
    take: 20,
    orderBy: { createdAt: "desc" },
    select: {
      id: true, name: true, email: true, role: true, createdAt: true, profile: { select: { username: true } },
      _count: { select: { communityPosts: true, communityComments: true } },
      communityRestrictions: { where: { liftedAt: null }, select: { id: true, state: true, reason: true, startsAt: true, endsAt: true, liftedAt: true } },
    },
  });
  return users;
}

export async function adminGetUserRestrictions(userId: string) {
  return db.communityRestriction.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    include: { issuedBy: { select: { name: true, email: true } } },
    take: 50,
  });
}

export async function adminListHistory(page: number, pageSize = 30) {
  const where: Prisma.AuditLogWhereInput = { entityType: { startsWith: "Community" } };
  const [items, total] = await Promise.all([
    db.auditLog.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * pageSize, take: pageSize, include: { actor: { select: { name: true, email: true } } } }),
    db.auditLog.count({ where }),
  ]);
  return { items, total, pageSize };
}

export async function adminOverviewCounts() {
  const [posts, hidden, removed, openReports, activeRestrictions, comments] = await Promise.all([
    db.communityPost.count({ where: { status: "PUBLISHED" } }),
    db.communityPost.count({ where: { status: "HIDDEN" } }),
    db.communityPost.count({ where: { status: "REMOVED" } }),
    db.communityReport.count({ where: { status: "OPEN" } }),
    db.communityRestriction.count({ where: { liftedAt: null, OR: [{ endsAt: null }, { endsAt: { gt: new Date() } }] } }),
    db.communityComment.count({ where: { status: "PUBLISHED" } }),
  ]);
  return { posts, hidden, removed, openReports, activeRestrictions, comments };
}
