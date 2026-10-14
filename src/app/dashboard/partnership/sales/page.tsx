import type { Metadata } from "next";
import { requireApprovedPartnerPage } from "@/features/partnership/guard";
import { PAGE_SIZE, listAttributedOrders } from "@/features/partnership/queries";
import { EmptyState, Pager, SOURCE_LABEL, StatusPill, fmtDate, parsePage } from "@/components/partnership/ui";
import { formatMoney } from "@/lib/partnership/rules";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Sales & purchases", robots: { index: false, follow: false } };

const ORDER_LABEL: Record<string, string> = { PAID: "Paid", PENDING: "Awaiting payment", FAILED: "Payment failed", REFUNDED: "Refunded", CANCELLED: "Cancelled" };

export default async function PartnerSalesPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const profile = await requireApprovedPartnerPage();
  const page = parsePage((await searchParams).page);
  const { items, total } = await listAttributedOrders(profile.id, page);

  return (
    <div className="min-w-0">
      <h1 className="text-2xl font-semibold text-slate-900">Sales &amp; purchases</h1>
      <p className="mt-1 text-sm text-slate-600">
        Orders credited to you at checkout. Only orders with a verified payment earn commission; unpaid, failed and refunded orders never do.
      </p>
      {items.length === 0 ? (
        <div className="mt-6">
          <EmptyState title="No referred purchases yet." />
        </div>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="bg-slate-50 text-left text-slate-500">
              <tr>
                <th className="px-4 py-2 font-medium">Date</th>
                <th className="px-4 py-2 font-medium">Order</th>
                <th className="px-4 py-2 font-medium">Buyer</th>
                <th className="px-4 py-2 font-medium">Products</th>
                <th className="px-4 py-2 font-medium">Order status</th>
                <th className="px-4 py-2 font-medium">Eligible amount</th>
                <th className="px-4 py-2 font-medium">Your commission</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.map((o) => (
                <tr key={o.reference + o.date.toISOString()}>
                  <td className="whitespace-nowrap px-4 py-2 text-slate-600">{fmtDate(o.date)}</td>
                  <td className="px-4 py-2 font-mono text-xs text-slate-600">
                    #{o.reference}
                    <span className="block font-sans text-[11px] text-slate-400">{SOURCE_LABEL[o.source]}</span>
                  </td>
                  <td className="px-4 py-2 text-slate-700">{o.buyer}</td>
                  <td className="px-4 py-2 text-slate-700">{o.products.join(", ")}</td>
                  <td className="px-4 py-2 text-slate-600">{ORDER_LABEL[o.orderStatus] ?? o.orderStatus}</td>
                  <td className="px-4 py-2 text-slate-700">{o.basisCents ? formatMoney(o.basisCents, o.currency) : "—"}</td>
                  <td className="px-4 py-2 text-slate-700">
                    {o.commissionCents ? formatMoney(o.commissionCents, o.currency) : "—"}
                    <span className="mt-1 flex flex-wrap gap-1">
                      {o.commissionStatuses.map((s) => (
                        <StatusPill key={s} status={s} />
                      ))}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Pager page={page} total={total} pageSize={PAGE_SIZE} href={(p) => `/dashboard/partnership/sales${p > 1 ? `?page=${p}` : ""}`} />
    </div>
  );
}
