"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireSession } from "@/lib/authorization";
import { updateSession } from "@/lib/auth";
import { db } from "@/lib/db";

/**
 * Self-service seller onboarding: any signed-in USER can become a SELLER by
 * filling in a display name — no admin approval gate in this phase (matches
 * "a customer must be able to become a seller" in the acceptance criteria).
 * Does nothing to an already-elevated account (AUTHOR/MODERATOR/ADMIN/
 * SUPER_ADMIN keep their role) so this can't be used to self-demote staff.
 */
export async function becomeSellerAction(formData: FormData) {
  const session = await requireSession();
  const displayName = String(formData.get("displayName") ?? "").trim();
  if (displayName.length < 2) throw new Error("Please enter a display name.");

  await db.$transaction([
    db.user.updateMany({ where: { id: session.user.id, role: "USER" }, data: { role: "SELLER" } }),
    db.sellerProfile.upsert({
      where: { userId: session.user.id },
      update: { displayName },
      create: { userId: session.user.id, displayName },
    }),
  ]);

  // Without this, the redirect below races the JWT: the session cookie
  // still carries the pre-promotion role until the token is next refreshed,
  // so /seller's isSeller() check would bounce the user straight back to
  // sign-in immediately after they just became a seller.
  await updateSession({});

  revalidatePath("/dashboard");
  redirect("/seller");
}
