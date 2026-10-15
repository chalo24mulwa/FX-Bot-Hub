"use server";

import { redirect } from "next/navigation";
import { auth, updateSession } from "@/lib/auth";
import { createImpersonationSession, revokeImpersonationSession } from "./impersonation-service";
import { revalidatePath } from "next/cache";
import { runAdminAction, type AdminResult } from "./core";

// update() is typed for the standard session shape; these two custom payloads are read by the
// jwt callback in src/lib/auth.ts, which re-verifies everything against the database.
type UpdatePayload = Parameters<typeof updateSession>[0];
const asPayload = (data: { startImpersonation: string } | { endImpersonation: true }) => data as unknown as UpdatePayload;

/**
 * Starts a "view as user" session. The permission and every eligibility rule are
 * checked on the server (never from the page that rendered the button); the row
 * is written first, then the sign-in is switched by update(), and the jwt callback
 * re-verifies that row before it switches anything.
 */
export async function startImpersonationAction(targetUserId: string, reason: string): Promise<AdminResult<{ redirectTo: string; sessionId: string }>> {
  return runAdminAction(
    "user:impersonate",
    async (actor) => {
      const { session, target } = await createImpersonationSession(actor, targetUserId, reason);
      await updateSession(asPayload({ startImpersonation: session.id }));
      const seller = target.role === "SELLER" || target.role === "AUTHOR";
      return { redirectTo: seller ? "/seller" : "/dashboard", sessionId: session.id };
    },
    { rateLimit: { bucket: "admin:impersonate", limit: 10, windowSeconds: 600 } },
  );
}

/**
 * The "Exit" button. Deliberately does not go through the permission guards —
 * while viewing as a member the signed-in role is that member's, and getting
 * out must always work. update() hands the administrator their own identity back.
 */
export async function endImpersonationAction(): Promise<void> {
  const session = await auth();
  if (!session?.user.impersonation) redirect("/admin");
  const memberId = session.user.id;
  await updateSession(asPayload({ endImpersonation: true }));
  redirect(`/admin/users/${memberId}`);
}

export async function revokeImpersonationSessionAction(sessionId: string): Promise<AdminResult> {
  return runAdminAction("user:impersonate", async (actor) => {
    await revokeImpersonationSession(actor, sessionId);
    revalidatePath("/admin/access-sessions");
    return {};
  });
}
