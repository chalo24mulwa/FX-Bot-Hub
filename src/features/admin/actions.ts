"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/authorization";
import type { UserRole } from "@prisma/client";
import * as moderation from "./product-moderation-service";
import * as users from "./user-management-service";

// Server Actions get Next.js's built-in same-origin check for free, so
// these don't need the manual assertSameOrigin() used in src/app/api/**.

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
