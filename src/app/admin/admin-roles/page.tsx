import Link from "next/link";
import type { AdminRole } from "@prisma/client";
import { ADMIN_ROLE_CAPABILITIES, ADMIN_ROLE_LABELS } from "@/lib/authorization/permissions";
import { listAdminRoleHolders, listStaffSummary, ALL_ADMIN_ROLES } from "@/features/admin/admin-roles-service";
import { requireAdminPage } from "@/features/admin/viewer";

export const dynamic = "force-dynamic";

const DESCRIPTIONS: Record<AdminRole, string> = {
  USER_SUPPORT: "Find members, edit profiles, send password resets, suspend accounts and start “view as user” sessions. No access to financial records.",
  LISTING_MODERATOR: "Review the approval queue and approve, reject, suspend, take down or remove marketplace listings.",
  PARTNERSHIP_MANAGER: "Review Partner and Master Partner applications, create Partnership accounts and manage the programme.",
  FINANCE: "Review commissions and process payouts and refunds, with the finance reports.",
  CONTENT: "Manage the news and economic-calendar content.",
};

export default async function AdminRolesPage() {
  await requireAdminPage("admin_role:manage");
  const [holders, admins] = await Promise.all([listAdminRoleHolders(), listStaffSummary()]);

  return (
    <div>
      <h1 className="text-2xl font-semibold text-slate-900">Admin roles</h1>
      <p className="mt-1 max-w-2xl text-sm text-slate-500">
        Narrow, named roles for moderator-level staff. A moderator with no admin role keeps the general moderator access; granting one limits them to exactly what that role allows. Grant and revoke from a member&apos;s page — every change is audited.
      </p>

      <section className="mt-6">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">What each role can do</h2>
        <ul className="mt-3 grid gap-3 sm:grid-cols-2">
          {ALL_ADMIN_ROLES.map((role) => (
            <li key={role} className="rounded-lg border border-slate-200 bg-white p-3">
              <p className="text-sm font-semibold text-slate-900">{ADMIN_ROLE_LABELS[role]}</p>
              <p className="mt-1 text-xs text-slate-600">{DESCRIPTIONS[role]}</p>
              <p className="mt-2 text-[11px] text-slate-400">{ADMIN_ROLE_CAPABILITIES[role].filter((a) => a !== "admin:view_dashboard").join(" · ")}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-8">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Staff with admin roles</h2>
        {holders.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">Nobody holds an admin role yet. Open a moderator&apos;s member page to grant one.</p>
        ) : (
          <ul className="mt-3 divide-y divide-slate-100 rounded-lg border border-slate-200 bg-white text-sm">
            {holders.map(({ user, grants }) => (
              <li key={user.id} className="flex flex-wrap items-start justify-between gap-2 px-3 py-2">
                <div>
                  <Link href={`/admin/users/${user.id}`} className="font-medium text-blue-600 hover:underline">
                    {user.name ?? user.email}
                  </Link>
                  <span className="ml-2 text-xs text-slate-400">{user.role.replace("_", " ")}{user.bannedAt ? " · suspended" : ""}</span>
                </div>
                <div className="flex flex-wrap gap-1">
                  {grants.map((g) => (
                    <span key={g.role} className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs text-slate-700" title={g.by ? `Granted by ${g.by}` : undefined}>
                      {ADMIN_ROLE_LABELS[g.role]}
                    </span>
                  ))}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-8">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Administrators</h2>
        <ul className="mt-3 divide-y divide-slate-100 rounded-lg border border-slate-200 bg-white text-sm">
          {admins.map((admin) => (
            <li key={admin.id} className="flex items-center justify-between px-3 py-2">
              <Link href={`/admin/users/${admin.id}`} className="text-blue-600 hover:underline">
                {admin.name ?? admin.email}
              </Link>
              <span className="text-xs text-slate-500">{admin.role.replace("_", " ")}{admin.bannedAt ? " · suspended" : ""}</span>
            </li>
          ))}
        </ul>
        <p className="mt-2 text-xs text-slate-400">The last active Super Administrator can&apos;t be demoted or suspended.</p>
      </section>
    </div>
  );
}
