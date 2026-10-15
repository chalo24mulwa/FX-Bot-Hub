"use server";

import { revalidatePath } from "next/cache";
import type { UserRole } from "@prisma/client";
import * as moderation from "./product-moderation-service";
import * as users from "./user-admin-service";
import * as roles from "./admin-roles-service";
import * as listings from "./listing-admin-service";
import { adminCreatePartnerAccount, adminGrantMaster } from "@/features/partnership/admin-account-service";
import { AdminError, runAdminAction, type AdminResult } from "./core";

// Admin control centre actions. Each one re-checks its own permission on the
// server (runAdminAction → requirePermission), the page that rendered the
// button is never the guard. Services throw AdminError for expected failures.

const refreshUser = (id: string) => {
  revalidatePath("/admin/users");
  revalidatePath(`/admin/users/${id}`);
};

// -- members ----------------------------------------------------------------

export async function updateUserProfileAction(userId: string, input: unknown, reason: string): Promise<AdminResult> {
  return runAdminAction("user:edit", async (actor) => {
    await users.updateUserProfile(actor, userId, input, reason);
    refreshUser(userId);
    return {};
  });
}

export async function changeRoleAction(userId: string, role: string, reason: string): Promise<AdminResult> {
  return runAdminAction("user:manage_roles", async (actor) => {
    await users.changeUserRoleChecked(actor, userId, role as UserRole, reason);
    refreshUser(userId);
    return {};
  });
}

export async function setSuspendedAction(userId: string, suspending: boolean, reason: string): Promise<AdminResult> {
  return runAdminAction("user:suspend", async (actor) => {
    await users.setUserSuspendedChecked(actor, userId, suspending, reason);
    refreshUser(userId);
    return {};
  });
}

export async function resetUserPasswordAction(userId: string, reason: string): Promise<AdminResult> {
  return runAdminAction(
    "user:reset_password",
    async (actor) => {
      await users.initiateUserPasswordReset(actor, userId, reason);
      refreshUser(userId);
      return {};
    },
    { rateLimit: { bucket: "admin:reset-password", limit: 10, windowSeconds: 900 } },
  );
}

// -- partnership accounts ---------------------------------------------------

export async function createPartnerAccountAction(userId: string, reason: string): Promise<AdminResult<{ referralCode: string | null }>> {
  return runAdminAction("partnership:create_account", async (actor) => {
    const profile = await adminCreatePartnerAccount(actor.id, userId, reason);
    refreshUser(userId);
    revalidatePath("/admin/partnership");
    return { referralCode: profile.referralCode };
  });
}

export async function grantMasterPartnerAction(userId: string, reason: string): Promise<AdminResult> {
  return runAdminAction("partnership:manage", async (actor) => {
    await adminGrantMaster(actor.id, userId, reason);
    refreshUser(userId);
    revalidatePath("/admin/partnership");
    return {};
  });
}

// -- admin roles ------------------------------------------------------------

export async function grantAdminRoleAction(userId: string, role: string, reason: string): Promise<AdminResult> {
  return runAdminAction("admin_role:manage", async (actor) => {
    await roles.grantAdminRole(actor, userId, role, reason);
    refreshUser(userId);
    revalidatePath("/admin/admin-roles");
    return {};
  });
}

export async function revokeAdminRoleAction(userId: string, role: string, reason: string): Promise<AdminResult> {
  return runAdminAction("admin_role:manage", async (actor) => {
    await roles.revokeAdminRole(actor, userId, role, reason);
    refreshUser(userId);
    revalidatePath("/admin/admin-roles");
    return {};
  });
}

// -- listings ---------------------------------------------------------------

function listingRefresh(id: string) {
  revalidatePath("/admin/products");
  revalidatePath(`/admin/products/${id}`);
  revalidatePath("/marketplace");
  revalidatePath("/sitemap.xml");
}

/** Existing moderation functions throw plain Errors with readable messages; surface them as results. */
async function asAdminError<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    if (err instanceof AdminError) throw err;
    if (err instanceof Error && /^(Only |Please |Product )/.test(err.message)) throw new AdminError(err.message);
    throw err;
  }
}

export async function approveListingAction(productId: string): Promise<AdminResult> {
  return runAdminAction("product:moderate", async (actor) => {
    await asAdminError(() => moderation.approveProduct({ actorId: actor.id, productId, ipAddress: actor.ipAddress }));
    listingRefresh(productId);
    return {};
  });
}

export async function rejectListingAction(productId: string, reason: string): Promise<AdminResult> {
  return runAdminAction("product:moderate", async (actor) => {
    await asAdminError(() => moderation.rejectProduct({ actorId: actor.id, productId, reason, ipAddress: actor.ipAddress }));
    listingRefresh(productId);
    return {};
  });
}

export async function suspendListingAction(productId: string, reason: string): Promise<AdminResult> {
  return runAdminAction("product:moderate", async (actor) => {
    await asAdminError(() => moderation.suspendProduct({ actorId: actor.id, productId, reason, ipAddress: actor.ipAddress }));
    listingRefresh(productId);
    return {};
  });
}

export async function unpublishListingAction(productId: string, reason: string): Promise<AdminResult> {
  return runAdminAction("product:moderate", async (actor) => {
    await listings.transitionListing(actor, productId, "unpublish", reason);
    listingRefresh(productId);
    return {};
  });
}

export async function removeListingAction(productId: string, reason: string): Promise<AdminResult> {
  return runAdminAction("product:moderate", async (actor) => {
    await listings.transitionListing(actor, productId, "remove", reason);
    listingRefresh(productId);
    return {};
  });
}

export async function restoreListingAction(productId: string, reason: string): Promise<AdminResult> {
  return runAdminAction("product:moderate", async (actor) => {
    await listings.transitionListing(actor, productId, "restore", reason);
    listingRefresh(productId);
    return {};
  });
}

export async function editListingAction(productId: string, input: unknown, reason: string): Promise<AdminResult> {
  return runAdminAction("product:edit_any", async (actor) => {
    await listings.editListing(actor, productId, input, reason);
    listingRefresh(productId);
    return {};
  });
}

export async function deleteListingAction(productId: string, reason: string): Promise<AdminResult> {
  return runAdminAction("product:delete_any", async (actor) => {
    await listings.deleteListing(actor, productId, reason);
    listingRefresh(productId);
    return {};
  });
}
