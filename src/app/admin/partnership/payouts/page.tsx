import Link from "next/link";
import { requirePartnershipAdminPage } from "@/features/partnership/guard";
import { listPayoutsForAdmin } from "@/features/partnership/queries";
import { PAYOUT_METHOD_LABELS } from "@/features/partnership/payout-service";
import { PartnershipAdminTabs } from "@/components/partnership/admin-tabs";
import { PayoutControls } from "@/components/partnership/admin-controls";
import { StatusPill, fmtDate, firstParam } from "@/components/partnership/ui";
import { formatMoney } from "@/lib/partnership/rules";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

const STATUSES = ["REQUESTED", "APPROVED", "PAID", "REJECTED"];

export default async function AdminPartnerPayoutsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requirePartnershipAdminPage();
  const raw = firstParam((await searchParams).status);
  const status = STATUSES.includes(raw) ? raw : "";
  const payouts = await listPayoutsForAdmin(status || undefined);

  return (
    <div className="min-w-0">
      <h1 className="text-2xl font-semibold text-slate-900">Partner payouts</h1>
      <p className="mt-1 text-sm text-slate-500">
        No payout processor is connected. Approve a request, send the money through the chosen channel, then record the transfer reference — only that marks it paid.
      </p>
      <div className="mt-4">
        <PartnershipAdminTabs current="/admin/partnership/payouts" />
      </div>
      <div className="flex flex-wrap gap-2">
        {["", ...STATUSES].map((s) => (
          <Link
            key={s || "all"}
            href={`/admin/partnership/payouts${s ? `?status=${s}` : ""}`}
            className={cn("rounded-full border px-3 py-1 text-xs", status === s ? "border-slate-900 bg-slate-900 text-white" : "border-slate-300 bg-white text-slate-700")}
          >
            {s ? s.toLowerCase() : "all"}
          </Link>
        ))}
      </div>
      <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full min-w-[900px] text-sm">
          <thead className="bg-slate-50 text-left text-slate-500">
            <tr>
              <th className="px-3 py-2 font-medium">Partner</th>
              <th className="px-3 py-2 font-medium">Amount</th>
              <th className="px-3 py-2 font-medium">Send to</th>
              <th className="px-3 py-2 font-medium">Requested</th>
              <th className="px-3 py-2 font-medium">Status</th>
              <th className="px-3 py-2 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {payouts.map((p) => (
              <tr key={p.id} className="align-top">
                <td className="px-3 py-2">
                  <Link href={`/admin/partnership/${p.partner.id}`} className="text-violet-700 hover:underline">
                    {p.partner.user.name ?? p.partner.user.email}
                  </Link>
                  <span className="block text-xs text-slate-500">
                    {p.partner.user.email} · partner {p.partner.status.toLowerCase()}
                  </span>
                </td>
                <td className="px-3 py-2 font-medium">
                  {formatMoney(p.amountCents, p.currency)}
                  <span className="block text-xs font-normal text-slate-500">{p._count.commissions} commission(s)</span>
                </td>
                <td className="px-3 py-2">
                  {PAYOUT_METHOD_LABELS[p.method] ?? p.method}
                  <span className="block break-all text-xs text-slate-600">{p.destination}</span>
                </td>
                <td className="whitespace-nowrap px-3 py-2 text-slate-600">{fmtDate(p.requestedAt)}</td>
                <td className="px-3 py-2">
                  <StatusPill status={p.status} />
                  {p.paymentReference && <span className="mt-1 block text-xs text-slate-500">Ref {p.paymentReference}</span>}
                  {p.rejectionReason && <span className="mt-1 block max-w-[14rem] text-xs text-slate-500">{p.rejectionReason}</span>}
                </td>
                <td className="px-3 py-2">
                  <PayoutControls id={p.id} status={p.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {payouts.length === 0 && <p className="py-8 text-center text-sm text-slate-500">No payout requests.</p>}
      </div>
    </div>
  );
}
