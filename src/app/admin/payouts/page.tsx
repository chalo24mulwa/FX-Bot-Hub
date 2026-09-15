import { listPayouts } from "@/features/payouts/payout-service";
import { Badge } from "@/components/ui/badge";
import { formatPriceCents } from "@/lib/utils";
import { PayoutActions } from "@/components/admin/payout-actions";

export const dynamic = "force-dynamic";

const STATUS_STYLES: Record<string, string> = {
  PENDING: "bg-amber-50 text-amber-700 border-amber-200",
  PROCESSING: "bg-blue-50 text-blue-700 border-blue-200",
  PAID: "bg-emerald-50 text-emerald-700 border-emerald-200",
  FAILED: "bg-red-50 text-red-700 border-red-200",
};

export default async function AdminPayoutsPage() {
  const { items: payouts } = await listPayouts(1, 100);

  return (
    <div>
      <h1 className="text-2xl font-semibold text-slate-900">Payouts</h1>
      <p className="mt-1 text-sm text-slate-500">
        No payout processor is wired up — this tracks the request and its status; move money through whatever
        channel is actually in use, then mark it paid here.
      </p>

      <div className="mt-6 overflow-x-auto">
        <table className="w-full min-w-[680px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-slate-500">
              <th className="py-2 pr-3">Seller</th>
              <th className="py-2 pr-3">Payout email</th>
              <th className="py-2 pr-3">Amount</th>
              <th className="py-2 pr-3">Requested</th>
              <th className="py-2 pr-3">Status</th>
              <th className="py-2 pr-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {payouts.map((payout) => (
              <tr key={payout.id} className="border-b border-slate-100">
                <td className="py-2 pr-3 font-medium text-slate-900">{payout.seller.name ?? payout.seller.email}</td>
                <td className="py-2 pr-3 text-slate-500">{payout.payoutEmail ?? "—"}</td>
                <td className="py-2 pr-3 text-slate-600">{formatPriceCents(payout.amountCents, payout.currency)}</td>
                <td className="py-2 pr-3 text-slate-500">{payout.requestedAt.toLocaleDateString()}</td>
                <td className="py-2 pr-3">
                  <Badge className={STATUS_STYLES[payout.status]}>{payout.status}</Badge>
                </td>
                <td className="py-2 pr-3">
                  <PayoutActions payoutId={payout.id} status={payout.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {payouts.length === 0 && <p className="py-8 text-center text-slate-500">No payout requests yet.</p>}
      </div>
    </div>
  );
}
