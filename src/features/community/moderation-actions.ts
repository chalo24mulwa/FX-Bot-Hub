"use server";

import type { CommunityContentStatus } from "@prisma/client";
import { requirePermission } from "@/lib/authorization";
import type { ActionResult } from "./core";
import { runAction } from "./action-utils";
import {
  createCategory,
  liftRestriction,
  moderateCommentStatus,
  moderatePostStatus,
  resolveReport,
  restrictMember,
  setPostFlag,
  updateCategory,
} from "./moderation-service";

// Community moderation server actions. Every one re-checks the staff
// permission on the server (the /admin layout gate is only the UI layer),
// then delegates to a service that writes the audit trail.

export async function moderatePostAction(postId: string, status: CommunityContentStatus, note?: string): Promise<ActionResult> {
  return runAction(async (actor) => {
    await requirePermission("community:moderate");
    await moderatePostStatus(actor, postId, status, note);
    return {};
  });
}

export async function moderateCommentAction(commentId: string, status: CommunityContentStatus, note?: string): Promise<ActionResult> {
  return runAction(async (actor) => {
    await requirePermission("community:moderate");
    await moderateCommentStatus(actor, commentId, status, note);
    return {};
  });
}

export async function setPostFlagAction(postId: string, flag: "isPinned" | "isFeatured" | "isLocked", value: boolean): Promise<ActionResult> {
  return runAction(async (actor) => {
    await requirePermission("community:moderate");
    if (flag !== "isPinned" && flag !== "isFeatured" && flag !== "isLocked") throw new Error("invalid flag");
    await setPostFlag(actor, postId, flag, value);
    return {};
  });
}

export async function resolveReportAction(reportId: string, status: "RESOLVED" | "DISMISSED", note?: string): Promise<ActionResult> {
  return runAction(async (actor) => {
    await requirePermission("community:moderate");
    await resolveReport(actor, reportId, status, note);
    return {};
  });
}

export async function restrictMemberAction(input: unknown): Promise<ActionResult> {
  return runAction(async (actor) => {
    await requirePermission("community:moderate");
    await restrictMember(actor, input);
    return {};
  });
}

export async function liftRestrictionAction(restrictionId: string, note?: string): Promise<ActionResult> {
  return runAction(async (actor) => {
    await requirePermission("community:moderate");
    await liftRestriction(actor, restrictionId, note);
    return {};
  });
}

export async function createCategoryAction(input: unknown): Promise<ActionResult> {
  return runAction(async (actor) => {
    await requirePermission("community:manage_categories");
    await createCategory(actor, input);
    return {};
  });
}

export async function updateCategoryAction(categoryId: string, input: unknown): Promise<ActionResult> {
  return runAction(async (actor) => {
    await requirePermission("community:manage_categories");
    await updateCategory(actor, categoryId, input);
    return {};
  });
}
