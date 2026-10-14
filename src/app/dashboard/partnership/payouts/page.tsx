import type { Metadata } from "next";
import { requireApprovedPartnerPage } from "@/features/partnership/guard";
import { getPartnershipSettings } from "@/features/partnership/core";
import { getPartnerOverview, listMyPayouts } from "@/features/partnership/queries";
import { PAYOUT_METHOD_LABELS } from "@/features/partnership/payout-service";
import { PayoutRequestForm } from "@/components/partnership/forms";
import { EmptyState, MoneyList, StatCard, StatusPill, fmtDate } from "@/components/partnership/ui";
import { formatMoney, maskDestination } from "@/lib/partnership/rules";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Payouts", robots: { index: false, follow: false } };

export default async function PayoutsPage() {
  const profile = await requireApprovedPartnerPage();
  const [settings, overview, payouts] = await Promise.all([getPartnershipSettings(), getPartnerOverview(profile.id), listMyPayouts(profile.id)]);
  const open = new Set(payouts.filter((p) => p.status === "REQUESTED" || p.status === "APPROVED").map((p) => p.currency));
  const eligible = overview.totals.filter((t) => t.available >= settings.minPayoutCents && t.available > 0 && !open.has(t.currency));
  const minLabel = formatMoney(settings.minPayoutCents, settings.currencies[0] ?? "USD");

  return (
    <div className="min-w-0 space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Payouts</h1>
        <p className="mt-1 text-sm text-slate-600">
          Request your approved balance once it reaches {minLabel}. The FXBotHub team reviews each request, sends the money, and records the transfer reference here.
        </p>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatCard label="Available for payout" value={<MoneyList items={overview.totals} field="available" />} />
        <StatCard label="In a payout request" value={<MoneyList items={overview.totals} field="inPayout" />} />
        <StatCard label="Total paid" value={<MoneyList items={overview.totals} field="paid" />} />
      </div>

      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="text-lg font-semibold text-slate-900">Request a payout</h2>
        <div className="mt-3">
          {profile.status !== "APPROVED" ? (
            <p className="text-sm text-red-700">Payouts are paused while your Partnership is suspended.</p>
          ) : eligible.length === 0 ? (
            <p className="text-sm text-slate-600">
              {open.size > 0 ? "You have a payout request in progress. " : ""}
              You can request a payout when your approved balance in a currency reaches {minLabel}.
            </p>
          ) : (
            <PayoutRequestForm
              currencies={eligible.map((t) => ({ currency: t.currency, available: formatMoney(t.available, t.currency) }))}
              methods={settings.payoutMethods.map((m) => ({ value: m, label: PAYOUT_METHOD_LABELS[m] ?? m }))}
            />
          )}
        </div>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-slate-900">Payout history</h2>
        {payouts.length === 0 ? (
          <div className="mt-3">
            <EmptyState title="No payouts yet." />
          </div>
        ) : (
          <div className="mt-3 overflow-x-auto rounded-xl border border-slate-200 bg-white">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="bg-slate-50 text-left text-slate-500">
                <tr>
                  <th className="px-4 py-2 font-medium">Requested</th>
                  <th className="px-4 py-2 font-medium">Amount</th>
                  <th className="px-4 py-2 font-medium">Method</th>
                  <th className="px-4 py-2 font-medium">Status</th>
                  <th className="px-4 py-2 font-medium">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {payouts.map((p) => (
                  <tr key={p.id} className="align-top">
                    <td className="whitespace-nowrap px-4 py-2 text-slate-600">{fmtDate(p.requestedAt)}</td>
                    <td className="px-4 py-2 font-medium text-slate-900">{formatMoney(p.amountCents, p.currency)}</td>
                    <td className="px-4 py-2 text-slate-600">
                      {PAYOUT_METHOD_LABELS[p.method] ?? p.method}
                      <span className="block text-xs text-slate-400">{maskDestination(p.destination)}</span>
                    </td>
                    <td className="px-4 py-2">
                      <StatusPill status={p.status} />
                    </td>
                    <td className="px-4 py-2 text-xs text-slate-600">
                      {p.status === "PAID" && `Sent ${fmtDate(p.paidAt)} · Ref ${p.paymentReference}`}
                      {p.status === "REJECTED" && p.rejectionReason}
                      {(p.status === "REQUESTED" || p.status === "APPROVED") && "Being processed"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
