import Link from "next/link";
import { requirePartnershipAdminPage } from "@/features/partnership/guard";
import { PAGE_SIZE, getAdminProgrammeOverview, getCtaClickReport, listPartnersForAdmin } from "@/features/partnership/queries";
import { PartnershipAdminTabs } from "@/components/partnership/admin-tabs";
import { Pager, StatCard, StatusPill, fmtDate, firstParam, parsePage } from "@/components/partnership/ui";
import { formatMoney } from "@/lib/partnership/rules";

export const dynamic = "force-dynamic";

const PARTNER_STATUSES = ["PENDING", "APPROVED", "REJECTED", "SUSPENDED"];
const MASTER_STATUSES = ["PENDING", "APPROVED", "REJECTED", "SUSPENDED"];

export default async function AdminPartnersPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requirePartnershipAdminPage();
  const sp = await searchParams;
  const status = PARTNER_STATUSES.includes(firstParam(sp.status)) ? firstParam(sp.status) : "";
  const master = MASTER_STATUSES.includes(firstParam(sp.master)) ? firstParam(sp.master) : "";
  const q = firstParam(sp.q).slice(0, 80);
  const page = parsePage(sp.page);
  const [overview, { items, total }, ctaClicks] = await Promise.all([getAdminProgrammeOverview(), listPartnersForAdmin({ status, master, q, page }), getCtaClickReport(30)]);
  const qs = (p: number) => {
    const u = new URLSearchParams();
    if (status) u.set("status", status);
    if (master) u.set("master", master);
    if (q) u.set("q", q);
    if (p > 1) u.set("page", String(p));
    const s = u.toString();
    return `/admin/partnership${s ? `?${s}` : ""}`;
  };
  const byStatus = (s: string) => overview.commissions.filter((c) => c.status === s);

  return (
    <div className="min-w-0">
      <h1 className="text-2xl font-semibold text-slate-900">Partnership Programme</h1>
      <p className="mt-1 text-sm text-slate-500">Applications, Partners, Master Partners, commissions and payouts. Every decision is recorded in the audit log.</p>
      <div className="mt-4">
        <PartnershipAdminTabs current="/admin/partnership" />
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Partner applications pending" value={overview.pendingPartners} />
        <StatCard label="Master applications pending" value={overview.pendingMasters} />
        <StatCard label="Active Partners / Masters" value={`${overview.approvedPartners} / ${overview.approvedMasters}`} />
        <StatCard label="Open payout requests" value={overview.openPayouts} />
        {["PENDING", "APPROVED", "PAID", "REVERSED"].map((s) => (
          <StatCard
            key={s}
            label={`Commission ${s.toLowerCase()}`}
            value={byStatus(s).length ? byStatus(s).map((c) => formatMoney(c.amountCents, c.currency)).join(" · ") : "—"}
          />
        ))}
      </div>

      <details className="mt-6 rounded-xl border border-slate-200 bg-white p-4">
        <summary className="cursor-pointer text-sm font-medium text-slate-800">
          &ldquo;Be Our Partner&rdquo; clicks, last 30 days ({ctaClicks.reduce((s, c) => s + c.clicks, 0)})
        </summary>
        {ctaClicks.length === 0 ? (
          <p className="mt-2 text-sm text-slate-500">No clicks recorded yet.</p>
        ) : (
          <ul className="mt-3 grid gap-1 text-sm sm:grid-cols-2 lg:grid-cols-3">
            {ctaClicks.map((c) => (
              <li key={c.placement} className="flex justify-between gap-4 rounded-md bg-slate-50 px-3 py-1.5">
                <span className="text-slate-700">{c.placement}</span>
                <span className="font-medium text-slate-900">{c.clicks}</span>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-2 text-xs text-slate-500">Only the placement is recorded — no user, IP address or page URL.</p>
      </details>

      <form method="get" className="mt-8 flex flex-wrap items-end gap-2">
        <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">
          Partner status
          <select name="status" defaultValue={status} className="h-9 rounded-md border border-slate-300 bg-white px-2 text-sm">
            <option value="">Any</option>
            {PARTNER_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s.toLowerCase()}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">
          Master status
          <select name="master" defaultValue={master} className="h-9 rounded-md border border-slate-300 bg-white px-2 text-sm">
            <option value="">Any</option>
            {MASTER_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s.toLowerCase()}
              </option>
            ))}
          </select>
        </label>
        <label className="flex min-w-0 flex-1 flex-col gap-1 text-xs font-medium text-slate-600">
          Search
          <input name="q" defaultValue={q} placeholder="Name, email or code" className="h-9 rounded-md border border-slate-300 px-2 text-sm" />
        </label>
        <button className="h-9 rounded-md bg-slate-900 px-4 text-sm font-medium text-white">Filter</button>
      </form>

      <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full min-w-[820px] text-sm">
          <thead className="bg-slate-50 text-left text-slate-500">
            <tr>
              <th className="px-4 py-2 font-medium">Member</th>
              <th className="px-4 py-2 font-medium">Applied</th>
              <th className="px-4 py-2 font-medium">Partner</th>
              <th className="px-4 py-2 font-medium">Master</th>
              <th className="px-4 py-2 font-medium">Code</th>
              <th className="px-4 py-2 font-medium">Visits / referred / recruits</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {items.map((p) => (
              <tr key={p.id}>
                <td className="px-4 py-2">
                  <span className="font-medium text-slate-900">{p.user.name ?? "—"}</span>
                  <span className="block text-xs text-slate-500">{p.user.email}</span>
                </td>
                <td className="whitespace-nowrap px-4 py-2 text-slate-600">{fmtDate(p.appliedAt)}</td>
                <td className="px-4 py-2">
                  <StatusPill status={p.status} />
                </td>
                <td className="px-4 py-2">
                  <StatusPill status={p.masterStatus} />
                </td>
                <td className="px-4 py-2 font-mono text-xs">{p.referralCode ?? "—"}</td>
                <td className="px-4 py-2 text-slate-600">
                  {p._count.clicks} / {p._count.referredUsers} / {p._count.recruits}
                </td>
                <td className="px-4 py-2 text-right">
                  <Link href={`/admin/partnership/${p.id}`} className="font-medium text-violet-700 hover:underline">
                    Review
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {items.length === 0 && <p className="py-8 text-center text-sm text-slate-500">No Partners match these filters.</p>}
      </div>
      <Pager page={page} total={total} pageSize={PAGE_SIZE} href={qs} />
    </div>
  );
}
