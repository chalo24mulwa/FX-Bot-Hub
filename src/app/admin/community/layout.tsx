import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { can } from "@/lib/authorization";
import { db } from "@/lib/db";
import { CommunityAdminTabs } from "@/components/admin/community-tabs";

export const dynamic = "force-dynamic";

// The /admin layout already requires a staff role; this re-checks the specific
// Community capability so a future role change can't silently widen access.
export default async function AdminCommunityLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user || !can(session.user.role, "community:moderate")) redirect("/auth/sign-in");
  const openReports = await db.communityReport.count({ where: { status: "OPEN" } });
  return (
    <div>
      <h1 className="text-2xl font-semibold text-slate-900">Community moderation</h1>
      <p className="mb-4 mt-1 text-sm text-slate-500">
        Posts, reports and Community-only restrictions. These are separate from a site-wide account ban (
        <Link className="text-blue-600 hover:underline" href="/admin/users">
          Users
        </Link>
        ).
      </p>
      <CommunityAdminTabs openReports={openReports} />
      {children}
    </div>
  );
}
