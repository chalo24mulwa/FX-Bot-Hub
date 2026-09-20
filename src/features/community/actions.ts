"use server";

import type { ActionResult } from "./core";
import { runAction } from "./action-utils";
import {
  createComment,
  createPost,
  deleteOwnComment,
  deleteOwnPost,
  reportContent,
  toggleBookmark,
  toggleCommentVote,
  toggleFollow,
  togglePostVote,
  updateComment,
  updateCommunityProfile,
  updatePost,
} from "./service";

// Member-facing Community server actions. Next gives these a same-origin
// (CSRF) check; each one requires a session, applies a Redis rate limit that
// fails open, then defers to the service layer, which re-checks Community
// standing and ownership from the database.

export async function createPostAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  return runAction(async (actor) => createPost(actor, input), { rateLimit: { bucket: "community:post", limit: 10, windowSeconds: 3600 } });
}

export async function updatePostAction(postId: string, input: unknown): Promise<ActionResult<{ id: string }>> {
  return runAction(async (actor) => updatePost(actor, postId, input), { rateLimit: { bucket: "community:post-edit", limit: 30, windowSeconds: 3600 } });
}

export async function deletePostAction(postId: string): Promise<ActionResult> {
  return runAction(async (actor) => {
    await deleteOwnPost(actor, postId);
    return {};
  });
}

export async function createCommentAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  return runAction(async (actor) => createComment(actor, input), { rateLimit: { bucket: "community:comment", limit: 30, windowSeconds: 600 } });
}

export async function updateCommentAction(commentId: string, content: string): Promise<ActionResult> {
  return runAction(
    async (actor) => {
      await updateComment(actor, commentId, content);
      return {};
    },
    { rateLimit: { bucket: "community:comment-edit", limit: 30, windowSeconds: 600 } }
  );
}

export async function deleteCommentAction(commentId: string): Promise<ActionResult> {
  return runAction(async (actor) => {
    await deleteOwnComment(actor, commentId);
    return {};
  });
}

export async function togglePostVoteAction(postId: string): Promise<ActionResult<{ liked: boolean; likeCount: number }>> {
  return runAction(async (actor) => togglePostVote(actor, postId), { rateLimit: { bucket: "community:vote", limit: 120, windowSeconds: 600 } });
}

export async function toggleCommentVoteAction(commentId: string): Promise<ActionResult<{ liked: boolean; likeCount: number }>> {
  return runAction(async (actor) => toggleCommentVote(actor, commentId), { rateLimit: { bucket: "community:vote", limit: 120, windowSeconds: 600 } });
}

export async function toggleBookmarkAction(postId: string): Promise<ActionResult<{ bookmarked: boolean }>> {
  return runAction(async (actor) => toggleBookmark(actor, postId), { rateLimit: { bucket: "community:bookmark", limit: 120, windowSeconds: 600 } });
}

export async function toggleFollowAction(postId: string): Promise<ActionResult<{ following: boolean }>> {
  return runAction(async (actor) => toggleFollow(actor, postId), { rateLimit: { bucket: "community:follow", limit: 120, windowSeconds: 600 } });
}

export async function reportContentAction(input: unknown): Promise<ActionResult> {
  return runAction(
    async (actor) => {
      await reportContent(actor, input);
      return {};
    },
    { rateLimit: { bucket: "community:report", limit: 20, windowSeconds: 3600 } }
  );
}

export async function updateCommunityProfileAction(input: { username?: string; bio?: string }): Promise<ActionResult> {
  return runAction(
    async (actor) => {
      await updateCommunityProfile(actor, { username: typeof input?.username === "string" ? input.username : undefined, bio: typeof input?.bio === "string" ? input.bio : undefined });
      return {};
    },
    { rateLimit: { bucket: "community:profile", limit: 20, windowSeconds: 3600 } }
  );
}
