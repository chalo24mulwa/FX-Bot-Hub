import Link from "next/link";
import { notFound } from "next/navigation";
import type { AdminRole, UserRole } from "@prisma/client";
import { db } from "@/lib/db";
import { can, ADMIN_ROLE_CAPABILITIES, ADMIN_ROLE_LABELS } from "@/lib/authorization/permissions";
import { canActOnAccount, evaluateImpersonation, evaluateRoleChange } from "@/lib/admin/rules";
import { getUserDetail } from "@/features/admin/user-admin-service";
import { requireAdminPage } from "@/features/admin/viewer";
import { Badge } from "@/components/ui/badge";
import { ProfileEditForm, RoleChangeForm } from "@/components/admin/user-admin-forms";
import { UserAccountControls } from "@/components/admin/user-account-controls";
import { AdminRolesPanel } from "@/components/admin/admin-roles-panel";

export const dynamic = "force-dynamic";

const ALL_ROLES: UserRole[] = ["USER", "SELLER", "AUTHOR", "MODERATOR", "ADMIN", "SUPER_ADMIN"];

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-8 border-t border-slate-200 pt-5">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">{title}</h2>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className="mt-0.5 text-sm text-slate-900">{children}</dd>
    </div>
  );
}

export default async function AdminUserDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const viewer = await requireAdminPage("user:view_all");
  const { id } = await params;
  const detail = await getUserDetail(id);
  if (!detail) notFound();
  const { user, listings, dependencies, hasHistory, recentAudit } = detail;

  const activeSuperAdmins = await db.user.count({ where: { role: "SUPER_ADMIN", bannedAt: null } });
  const target = { id: user.id, role: user.role, bannedAt: user.bannedAt };
  const isSelf = viewer.id === user.id;

  const assignable = ALL_ROLES.filter((r) => evaluateRoleChange({ actor: viewer, target, newRole: r, activeSuperAdmins }).ok);
  // Same rule the server enforces: only offer account actions on accounts this viewer outranks.
  const mayManage = canActOnAccount(viewer, target).ok;
  const accessDecision = evaluateImpersonation({ actor: viewer, target, alreadyImpersonating: false });
  const canAccess = can(viewer, "user:impersonate");

  const partner = user.partnerProfile;
  const resetBlocked = user.bannedAt ? "this account is suspended." : !user.hasPassword ? "this account signs in with Google and has no password." : null;
  const heldRoles = user.adminRoleGrants.map((g) => g.role) as AdminRole[];
  const capSummary = Object.fromEntries(
    (Object.keys(ADMIN_ROLE_CAPABILITIES) as AdminRole[]).map((r) => [r, ADMIN_ROLE_CAPABILITIES[r].filter((a) => a !== "admin:view_dashboard").join(", ")]),
  ) as Record<AdminRole, string>;
  const showAdminRoles = can(viewer, "admin_role:manage") && !isSelf && (user.role === "MODERATOR" || user.role === "USER" || user.role === "SELLER" || user.role === "AUTHOR");

  return (
    <div>
      <Link href="/admin/users" className="text-xs text-blue-600 hover:underline">
        ← All users
      </Link>
      <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">{user.name ?? user.email}</h1>
          <p className="mt-1 text-sm text-slate-500">{user.email}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <Badge>{user.role.replace("_", " ")}</Badge>
            {user.bannedAt ? <Badge className="border-red-200 bg-red-50 text-red-700">Suspended</Badge> : <Badge className="border-emerald-200 bg-emerald-50 text-emerald-700">Active</Badge>}
            {user.mustChangePassword && <Badge className="border-amber-200 bg-amber-50 text-amber-800">Temporary password</Badge>}
            {heldRoles.map((r) => (
              <Badge key={r}>{ADMIN_ROLE_LABELS[r]}</Badge>
            ))}
          </div>
        </div>
        {canAccess && (
          <div className="text-right">
            {accessDecision.ok ? (
              <Link href={`/admin/users/${user.id}/impersonate`} className="inline-block rounded-md bg-amber-600 px-3 py-2 text-sm font-medium text-white hover:bg-amber-700">
                Access account
              </Link>
            ) : (
              <p className="max-w-xs text-xs text-slate-500">Account access unavailable: {accessDecision.error}</p>
            )}
          </div>
        )}
      </div>

      <dl className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Fact label="User ID">
          <code className="break-all text-xs">{user.id}</code>
        </Fact>
        <Fact label="Joined">{user.createdAt.toLocaleDateString()}</Fact>
        <Fact label="Email verified">{user.emailVerified ? user.emailVerified.toLocaleDateString() : "No"}</Fact>
        <Fact label="Sign-in methods">{[user.hasPassword ? "Password" : null, ...user.linkedProviders.map((p) => p[0].toUpperCase() + p.slice(1))].filter(Boolean).join(", ") || "—"}</Fact>
        <Fact label="Display name">{user.profile?.displayName ?? "—"}</Fact>
        <Fact label="Seller profile">{user.sellerProfile?.displayName ?? "—"}</Fact>
        <Fact label="Public username">{user.profile?.username ? `@${user.profile.username}` : "—"}</Fact>
        <Fact label="Location">{user.profile?.location ?? "—"}</Fact>
      </dl>

      {!isSelf && (
        <Section title="Account actions">
          <UserAccountControls
            userId={user.id}
            suspended={Boolean(user.bannedAt)}
            canSuspend={can(viewer, "user:suspend") && mayManage}
            canReset={can(viewer, "user:reset_password") && (mayManage || viewer.role === "SUPER_ADMIN")}
            resetBlocked={resetBlocked}
            canCreatePartner={can(viewer, "partnership:create_account")}
            canGrantMaster={can(viewer, "partnership:manage")}
            partner={{ status: partner?.status ?? "none", masterStatus: partner?.masterStatus ?? "NOT_APPLIED" }}
          />
        </Section>
      )}

      {can(viewer, "user:manage_roles") && !isSelf && (
        <Section title="Account role">
          {assignable.length > 0 ? (
            <RoleChangeForm userId={user.id} role={user.role} assignable={assignable} />
          ) : (
            <p className="text-sm text-slate-500">You can&apos;t change this account&apos;s role (only roles below your own, on accounts below yours).</p>
          )}
        </Section>
      )}

      {showAdminRoles && (
        <Section title="Admin roles">
          <AdminRolesPanel userId={user.id} held={heldRoles} labels={ADMIN_ROLE_LABELS} caps={capSummary} />
        </Section>
      )}

      {can(viewer, "user:edit") && (
        <Section title="Edit profile">
          <ProfileEditForm
            userId={user.id}
            initial={{ name: user.name ?? "", displayName: user.profile?.displayName ?? "", bio: user.profile?.bio ?? "", location: user.profile?.location ?? "" }}
          />
        </Section>
      )}

      <Section title="Marketplace activity">
        <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Fact label="Listings">{dependencies.listings}</Fact>
          <Fact label="Published">{listings.PUBLISHED ?? 0}</Fact>
          <Fact label="Awaiting review">{(listings.PENDING_REVIEW ?? 0) + (listings.UNDER_REVIEW ?? 0)}</Fact>
          <Fact label="Orders placed">{dependencies.orders}</Fact>
          <Fact label="Licences">{dependencies.licenses}</Fact>
          <Fact label="Subscriptions">{dependencies.subscriptions}</Fact>
        </dl>
        {dependencies.listings > 0 && (
          <p className="mt-3 text-sm">
            <Link href={`/admin/products?seller=${encodeURIComponent(user.email)}`} className="text-blue-600 hover:underline">
              View this member&apos;s listings →
            </Link>
          </p>
        )}
      </Section>

      <Section title="Partnership">
        {partner ? (
          <div className="text-sm text-slate-700">
            <p>
              Partner: <strong>{partner.status.toLowerCase()}</strong> · Master Partner: <strong>{partner.masterStatus.toLowerCase().replace("_", " ")}</strong>
              {partner.referralCode && <> · code <code className="text-xs">{partner.referralCode}</code></>}
            </p>
            <p className="mt-2">
              <Link href={`/admin/partnership/${partner.id}`} className="text-blue-600 hover:underline">
                Open in Partnership management →
              </Link>
            </p>
          </div>
        ) : (
          <p className="text-sm text-slate-500">Not a Partner. Use &ldquo;Create Partnership account&rdquo; above to add them.</p>
        )}
      </Section>

      <Section title="Account removal">
        <p className="text-sm text-slate-600">
          {hasHistory
            ? "This account has marketplace, financial or referral history (counts above and below), so it can't be deleted without breaking orders, licences, ledger and audit records. Suspend it instead — the member is signed out and blocked, and nothing is lost."
            : "This account has no marketplace, financial or referral history. Suspending it blocks sign-in and keeps the record; permanent deletion isn't offered from this screen."}
        </p>
        <dl className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Fact label="Seller payouts">{dependencies.sellerPayouts}</Fact>
          <Fact label="Ledger entries">{dependencies.ledgerEntries}</Fact>
          <Fact label="Partner commissions">{dependencies.partnerCommissions}</Fact>
          <Fact label="Referred members">{dependencies.referredMembers}</Fact>
        </dl>
      </Section>

      <Section title="Recent history">
        {recentAudit.length === 0 ? (
          <p className="text-sm text-slate-500">No administrative actions recorded for this account.</p>
        ) : (
          <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200 bg-white text-sm">
            {recentAudit.map((log) => (
              <li key={log.id} className="flex flex-wrap items-baseline justify-between gap-2 px-3 py-2">
                <span>
                  <span className="font-mono text-xs text-slate-800">{log.action}</span>
                  <span className="ml-2 text-slate-500">{log.actor?.name ?? log.actor?.email ?? "system"}</span>
                </span>
                <time className="text-xs text-slate-400" dateTime={log.createdAt.toISOString()}>
                  {log.createdAt.toLocaleString()}
                </time>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-2 text-xs">
          <Link href={`/admin/audit-logs?entityType=User&entityId=${user.id}`} className="text-blue-600 hover:underline">
            Full history →
          </Link>
        </p>
      </Section>
    </div>
  );
}
