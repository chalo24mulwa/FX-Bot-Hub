"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/authorization";
import type { UserRole } from "@prisma/client";
import { db } from "@/lib/db";
import * as moderation from "./product-moderation-service";
import * as users from "./user-management-service";
import * as reviews from "@/features/reviews/review-service";
import { updateMarketplaceSettings, type RankingWeights } from "./settings-service";

// Server Actions get Next.js's built-in same-origin check for free, so
// these don't need the manual assertSameOrigin() used in src/app/api/**.

export async function claimForReviewAction(productId: string) {
  const session = await requirePermission("product:moderate");
  await moderation.claimForReview({ actorId: session.user.id, productId });
  revalidatePath("/admin/products");
}

export async function approveProductAction(productId: string) {
  const session = await requirePermission("product:moderate");
  await moderation.approveProduct({ actorId: session.user.id, productId });
  revalidatePath("/admin/products");
}

export async function rejectProductAction(productId: string, reason?: string) {
  const session = await requirePermission("product:moderate");
  await moderation.rejectProduct({ actorId: session.user.id, productId, reason });
  revalidatePath("/admin/products");
}

export async function suspendProductAction(productId: string, reason?: string) {
  const session = await requirePermission("product:moderate");
  await moderation.suspendProduct({ actorId: session.user.id, productId, reason });
  revalidatePath("/admin/products");
}

export async function toggleFeaturedAction(productId: string, featured: boolean) {
  const session = await requirePermission("product:moderate");
  await moderation.setProductFeatured({ actorId: session.user.id, productId }, featured);
  revalidatePath("/admin/products");
  revalidatePath("/");
}

export async function changeUserRoleAction(userId: string, role: UserRole) {
  const session = await requirePermission("user:manage_roles");
  await users.changeUserRole(session.user.id, userId, role);
  revalidatePath("/admin/users");
}

export async function setUserBannedAction(userId: string, banned: boolean) {
  const session = await requirePermission("user:suspend");
  await users.setUserBanned(session.user.id, userId, banned);
  revalidatePath("/admin/users");
}

export async function hideReviewAction(reviewId: string, hidden: boolean) {
  await requirePermission("review:delete_any");
  await reviews.setReviewHidden(reviewId, hidden);
  revalidatePath("/admin/reviews");
}

export async function deleteReviewAction(reviewId: string) {
  await requirePermission("review:delete_any");
  await reviews.deleteReview(reviewId);
  revalidatePath("/admin/reviews");
}

export async function updateMarketplaceSettingsAction(input: {
  commissionPercent?: number;
  rankingWeights?: Partial<RankingWeights>;
}) {
  const session = await requirePermission("admin:manage_settings");
  await updateMarketplaceSettings(session.user.id, input);
  revalidatePath("/admin/settings");
}

function slugifyCategory(name: string) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export async function createCategoryAction(formData: FormData) {
  await requirePermission("category:manage");
  const name = String(formData.get("name") ?? "").trim();
  if (!name) throw new Error("Name is required.");
  await db.productCategory.create({ data: { name, slug: slugifyCategory(name) } });
  revalidatePath("/admin/categories");
}

export async function deleteCategoryAction(categoryId: string) {
  await requirePermission("category:manage");
  await db.productCategory.delete({ where: { id: categoryId } });
  revalidatePath("/admin/categories");
}
