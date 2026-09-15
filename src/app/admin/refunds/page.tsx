import { listRefunds } from "@/features/refunds/refund-service";
import { Badge } from "@/components/ui/badge";
import { formatPriceCents } from "@/lib/utils";
import { RefundActions } from "@/components/admin/refund-actions";

export const dynamic = "force-dynamic";

const STATUS_STYLES: Record<string, string> = {
  REQUESTED: "bg-amber-50 text-amber-700 border-amber-200",
  APPROVED: "bg-blue-50 text-blue-700 border-blue-200",
  REJECTED: "bg-slate-100 text-slate-600 border-slate-200",
  PROCESSED: "bg-emerald-50 text-emerald-700 border-emerald-200",
};

export default async function AdminRefundsPage() {
  const { items: refunds } = await listRefunds(1, 100);

  return (
    <div>
      <h1 className="text-2xl font-semibold text-slate-900">Refunds</h1>
      <p className="mt-1 text-sm text-slate-500">
        Approving a refund charges it through the payment provider immediately and reverses the order&apos;s
        licenses/subscriptions and seller ledger entries.
      </p>

      <div className="mt-6 overflow-x-auto">
        <table className="w-full min-w-[720px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-slate-500">
              <th className="py-2 pr-3">Order</th>
              <th className="py-2 pr-3">Customer</th>
              <th className="py-2 pr-3">Amount</th>
              <th className="py-2 pr-3">Reason</th>
              <th className="py-2 pr-3">Status</th>
              <th className="py-2 pr-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {refunds.map((refund) => (
              <tr key={refund.id} className="border-b border-slate-100">
                <td className="py-2 pr-3 font-medium text-slate-900">#{refund.orderId.slice(0, 8)}</td>
                <td className="py-2 pr-3 text-slate-500">{refund.order.user.email}</td>
                <td className="py-2 pr-3 text-slate-600">{formatPriceCents(refund.amountCents, refund.currency)}</td>
                <td className="py-2 pr-3 max-w-xs truncate text-slate-500" title={refund.reason ?? undefined}>
                  {refund.reason ?? "—"}
                </td>
                <td className="py-2 pr-3">
                  <Badge className={STATUS_STYLES[refund.status]}>{refund.status}</Badge>
                </td>
                <td className="py-2 pr-3">{refund.status === "REQUESTED" && <RefundActions refundId={refund.id} />}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {refunds.length === 0 && <p className="py-8 text-center text-slate-500">No refunds yet.</p>}
      </div>
    </div>
  );
}
