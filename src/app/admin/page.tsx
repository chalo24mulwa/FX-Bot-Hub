import Link from "next/link";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";
import { getAdminOverview } from "@/features/admin/overview-service";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const dynamic = "force-dynamic";

function Stat({ label, value, href, alert }: { label: string; value: number; href?: string; alert?: boolean }) {
  const body = (
    <Card className={alert && value > 0 ? "border-amber-300 bg-amber-50" : undefined}>
      <CardHeader>
        <CardTitle className="text-sm font-medium text-slate-500">{label}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-bold tabular-nums text-slate-900">{value}</p>
      </CardContent>
    </Card>
  );
  return href ? (
    <Link href={href} className="block rounded-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-slate-400">
      {body}
    </Link>
  ) : (
    body
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">{title}</h2>
      <div className="mt-3 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">{children}</div>
    </section>
  );
}

export default async function AdminDashboardPage() {
  const session = await auth();
  if (!session?.user) redirect("/auth/sign-in");
  const [overview, paidOrders] = await Promise.all([getAdminOverview(session.user), db.order.count({ where: { status: "PAID" } })]);
  const { users, listings, partnership, money, recent } = overview;

  return (
    <div>
      <h1 className="text-2xl font-semibold text-slate-900">Dashboard</h1>

      {users && (
        <Section title="Members">
          <Stat label="Total users" value={users.total} href="/admin/users" />
          <Stat label="Active" value={users.active} href="/admin/users?status=active" />
          <Stat label="Suspended" value={users.suspended} href="/admin/users?status=suspended" />
          <Stat label="Sellers" value={users.sellers} href="/admin/users?seller=yes" />
        </Section>
      )}

      {listings && (
        <Section title="Marketplace listings">
          <Stat label="Awaiting approval" value={listings.pending} href="/admin/products?status=PENDING_REVIEW" alert />
          <Stat label="Published" value={listings.published} href="/admin/products?status=PUBLISHED" />
          <Stat label="Rejected" value={listings.rejected} href="/admin/products?status=REJECTED" />
          <Stat label="Suspended" value={listings.suspended} href="/admin/products?status=SUSPENDED" />
          <Stat label="Removed" value={listings.removed} href="/admin/products?status=ARCHIVED" />
          <Stat label="Drafts" value={listings.drafts} href="/admin/products?status=DRAFT" />
          <Stat label="All listings" value={listings.total} />
          <Stat label="Paid orders" value={paidOrders} />
        </Section>
      )}

      {partnership && (
        <Section title="Partnership programme">
          <Stat label="Partner applications" value={partnership.pendingPartners} href="/admin/partnership" alert />
          <Stat label="Approved Partners" value={partnership.partners} href="/admin/partnership" />
          <Stat label="Master applications" value={partnership.pendingMasters} href="/admin/partnership" alert />
          <Stat label="Approved Master Partners" value={partnership.masters} href="/admin/partnership" />
        </Section>
      )}

      {money && (
        <Section title="Commissions and payouts">
          <Stat label="Pending commissions" value={money.pendingCommissions} href="/admin/partnership/commissions" />
          <Stat label="Partner payout requests" value={money.partnerPayoutRequests} href="/admin/partnership/payouts" alert />
          <Stat label="Seller payouts pending" value={money.sellerPayoutRequests} href="/admin/payouts" alert />
        </Section>
      )}

      {recent && (
        <section className="mt-8">
          <div className="flex items-baseline justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Recent administrative activity</h2>
            <Link href="/admin/audit-logs" className="text-xs text-blue-600 hover:underline">
              Full audit log
            </Link>
          </div>
          <ul className="mt-3 divide-y divide-slate-100 rounded-lg border border-slate-200 bg-white text-sm">
            {recent.map((log) => (
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
            {recent.length === 0 && <li className="px-3 py-6 text-center text-slate-500">No activity yet.</li>}
          </ul>
        </section>
      )}
    </div>
  );
}
