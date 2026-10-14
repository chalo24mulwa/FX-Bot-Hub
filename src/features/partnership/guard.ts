import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getMyPartnerProfile, type MyPartnerProfile } from "./queries";

/** Page helper: the signed-in member's Partner profile, or a redirect to the Overview (which shows how to apply). */
export async function requireApprovedPartnerPage(): Promise<MyPartnerProfile> {
  const session = await auth();
  if (!session?.user) redirect("/auth/sign-in");
  const profile = await getMyPartnerProfile(session.user.id);
  // Suspended Partners can still see their history (read-only); never-approved members can't.
  if (!profile || !profile.referralCode || (profile.status !== "APPROVED" && profile.status !== "SUSPENDED")) redirect("/dashboard/partnership");
  return profile;
}

/** Admin pages: the /admin gate lets any staff member in; Partnership is admin-only (financial). */
export async function requirePartnershipAdminPage() {
  const session = await auth();
  const { can } = await import("@/lib/authorization/permissions");
  if (!session?.user || !can(session.user.role, "partnership:manage")) redirect("/admin");
  return session;
}
