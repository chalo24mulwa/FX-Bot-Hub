import Link from "next/link";
import { requirePartnershipAdminPage } from "@/features/partnership/guard";
import { PAGE_SIZE, listCommissionsForAdmin } from "@/features/partnership/queries";
import { PartnershipAdminTabs } from "@/components/partnership/admin-tabs";
import { CommissionControls, RecalculateOrderForm } from "@/components/partnership/admin-controls";
import { Pager, StatusPill, TIER_LABEL, fmtDate, firstParam, parsePage } from "@/components/partnership/ui";
import { formatMoney, formatRate } from "@/lib/partnership/rules";

export const dynamic = "force-dynamic";

const STATUSES = ["PENDING", "APPROVED", "PAID", "REVERSED", "REJECTED"];

function defaultExportRange() {
  const now = new Date();
  return { today: now.toISOString().slice(0, 10), monthAgo: new Date(now.getTime() - 30 * 86_400_000).toISOString().slice(0, 10) };
}

export default async function AdminCommissionsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requirePartnershipAdminPage();
  const sp = await searchParams;
  const status = STATUSES.includes(firstParam(sp.status)) ? firstParam(sp.status) : "";
  const type = ["PARTNER", "MASTER_PARTNER"].includes(firstParam(sp.type)) ? firstParam(sp.type) : "";
  const q = firstParam(sp.q).slice(0, 64);
  const page = parsePage(sp.page);
  const { items, total } = await listCommissionsForAdmin({ status, type, q, page });
  const href = (p: number) => {
    const u = new URLSearchParams();
    if (status) u.set("status", status);
    if (type) u.set("type", type);
    if (q) u.set("q", q);
    if (p > 1) u.set("page", String(p));
    const s = u.toString();
    return `/admin/partnership/commissions${s ? `?${s}` : ""}`;
  };
  const { today, monthAgo } = defaultExportRange();

  return (
    <div className="min-w-0">
      <h1 className="text-2xl font-semibold text-slate-900">Partnership commissions</h1>
      <p className="mt-1 text-sm text-slate-500">
        Pending commission becomes approved automatically after the holding period while the order stays paid. Refunds reverse unpaid commission automatically.
      </p>
      <div className="mt-4">
        <PartnershipAdminTabs current="/admin/partnership/commissions" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <form method="get" className="flex flex-wrap items-end gap-2">
          <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">
            Status
            <select name="status" defaultValue={status} className="h-9 rounded-md border border-slate-300 bg-white px-2 text-sm">
              <option value="">Any</option>
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s.toLowerCase()}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">
            Type
            <select name="type" defaultValue={type} className="h-9 rounded-md border border-slate-300 bg-white px-2 text-sm">
              <option value="">Any</option>
              <option value="PARTNER">Partner</option>
              <option value="MASTER_PARTNER">Master Partner</option>
            </select>
          </label>
          <label className="flex min-w-0 flex-1 flex-col gap-1 text-xs font-medium text-slate-600 max-sm:min-w-full">
            Order ID, commission ID or referral code
            <input name="q" defaultValue={q} className="h-9 rounded-md border border-slate-300 px-2 text-sm" />
          </label>
          <button className="h-9 rounded-md bg-slate-900 px-4 text-sm font-medium text-white">Filter</button>
        </form>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <RecalculateOrderForm />
          <form method="get" action="/api/admin/partnership/commissions-export" className="mt-4 flex flex-wrap items-end gap-2 border-t border-slate-100 pt-4">
            <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">
              From
              <input type="date" name="from" defaultValue={monthAgo} className="h-9 rounded-md border border-slate-300 px-2 text-sm" />
            </label>
            <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">
              To
              <input type="date" name="to" defaultValue={today} className="h-9 rounded-md border border-slate-300 px-2 text-sm" />
            </label>
            <button className="h-9 rounded-md border border-slate-300 px-3 text-sm font-medium text-slate-800 hover:bg-slate-50">Export CSV</button>
          </form>
        </div>
      </div>

      <div className="mt-6 overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full min-w-[980px] text-sm">
          <thead className="bg-slate-50 text-left text-slate-500">
            <tr>
              <th className="px-3 py-2 font-medium">Created</th>
              <th className="px-3 py-2 font-medium">Beneficiary</th>
              <th className="px-3 py-2 font-medium">Product / order</th>
              <th className="px-3 py-2 font-medium">Calculation</th>
              <th className="px-3 py-2 font-medium">Status</th>
              <th className="px-3 py-2 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {items.map((c) => (
              <tr key={c.id} className="align-top">
                <td className="whitespace-nowrap px-3 py-2 text-slate-600">
                  {fmtDate(c.createdAt)}
                  <span className="block text-xs text-slate-400">hold until {fmtDate(c.holdUntil)}</span>
                </td>
                <td className="px-3 py-2">
                  <Link href={`/admin/partnership/${c.beneficiary.id}`} className="text-violet-700 hover:underline">
                    {c.beneficiary.user.name ?? c.beneficiary.user.email}
                  </Link>
                  <span className="block text-xs text-slate-500">{TIER_LABEL[c.type]}</span>
                </td>
                <td className="px-3 py-2">
                  {c.orderItem.product.name}
                  <span className="block font-mono text-xs text-slate-500">
                    {c.orderId} · order {c.order.status.toLowerCase()}
                  </span>
                </td>
                <td className="whitespace-nowrap px-3 py-2">
                  {formatMoney(c.basisCents, c.currency)} × {formatRate(c.rateBps)} = <strong>{formatMoney(c.amountCents, c.currency)}</strong>
                </td>
                <td className="px-3 py-2">
                  <StatusPill status={c.status} />
                  {c.statusReason && <span className="mt-1 block max-w-[14rem] text-xs text-slate-500">{c.statusReason}</span>}
                  {c.payout && <span className="mt-1 block text-xs text-slate-500">in payout ({c.payout.status.toLowerCase()})</span>}
                </td>
                <td className="px-3 py-2">
                  <CommissionControls id={c.id} status={c.status} inPaidPayout={c.payout?.status === "PAID"} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {items.length === 0 && <p className="py-8 text-center text-sm text-slate-500">No commissions match.</p>}
      </div>
      <Pager page={page} total={total} pageSize={PAGE_SIZE} href={href} />
    </div>
  );
}
