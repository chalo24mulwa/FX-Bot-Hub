import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getMarketplaceSettings } from "@/features/admin/settings-service";
import { getSellerBalance, listLedgerEntries } from "@/repositories/ledger-repository";
import { listSellerPayouts } from "@/features/payouts/payout-service";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatPriceCents } from "@/lib/utils";
import { updatePayoutSettingsAction } from "@/features/seller/actions";
import { RequestPayoutButton } from "@/components/commerce/request-payout-button";

export const dynamic = "force-dynamic";

export default async function SellerPayoutPage() {
  const session = await auth();
  const [profile, settings, balanceCents, { items: ledgerEntries }, payouts] = await Promise.all([
    db.sellerProfile.findUnique({ where: { userId: session!.user.id } }),
    getMarketplaceSettings(),
    getSellerBalance(session!.user.id),
    listLedgerEntries(session!.user.id, 1, 50),
    listSellerPayouts(session!.user.id),
  ]);

  const hasPendingPayout = payouts.some((p) => p.status === "PENDING" || p.status === "PROCESSING");

  return (
    <div>
      <h1 className="text-2xl font-semibold text-slate-900">Payout &amp; balance</h1>
      <p className="mt-1 text-sm text-slate-500">
        Marketplace commission: {settings.commissionPercent}% — you keep {100 - settings.commissionPercent}% of every sale.
      </p>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-4 rounded-md border border-slate-200 p-4">
        <div>
          <p className="text-xs text-slate-400">Available balance</p>
          <p className="text-2xl font-semibold text-slate-900">{formatPriceCents(balanceCents, "USD")}</p>
        </div>
        <RequestPayoutButton disabled={hasPendingPayout || balanceCents < 1000} />
      </div>
      <p className="mt-2 text-xs text-slate-400">
        Actual money movement requires a real payout processor (Stripe Connect / M-Pesa B2C) — not wired up yet. A
        request records the amount owed; an admin marks it processed once paid out through whatever channel is
        actually in use.
      </p>

      <form action={updatePayoutSettingsAction} className="mt-8 flex max-w-md flex-col gap-4">
        <label className="flex flex-col gap-1 text-sm">
          Payout email
          <Input name="payoutEmail" type="email" defaultValue={profile?.payoutEmail ?? ""} placeholder="you@example.com" />
        </label>
        <Button type="submit" className="self-start">
          Save
        </Button>
      </form>

      {payouts.length > 0 && (
        <>
          <h2 className="mt-10 text-lg font-semibold text-slate-900">Payout history</h2>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[480px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-slate-500">
                  <th className="py-2 pr-3">Requested</th>
                  <th className="py-2 pr-3">Amount</th>
                  <th className="py-2 pr-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {payouts.map((p) => (
                  <tr key={p.id} className="border-b border-slate-100">
                    <td className="py-2 pr-3 text-slate-500">{p.requestedAt.toLocaleDateString()}</td>
                    <td className="py-2 pr-3 text-slate-600">{formatPriceCents(p.amountCents, p.currency)}</td>
                    <td className="py-2 pr-3">
                      <Badge>{p.status}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <h2 className="mt-10 text-lg font-semibold text-slate-900">Recent ledger activity</h2>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[560px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-slate-500">
              <th className="py-2 pr-3">Date</th>
              <th className="py-2 pr-3">Type</th>
              <th className="py-2 pr-3">Description</th>
              <th className="py-2 pr-3 text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            {ledgerEntries.map((entry) => (
              <tr key={entry.id} className="border-b border-slate-100">
                <td className="py-2 pr-3 text-slate-500">{entry.createdAt.toLocaleDateString()}</td>
                <td className="py-2 pr-3">
                  <Badge>{entry.type}</Badge>
                </td>
                <td className="py-2 pr-3 text-slate-600">{entry.description}</td>
                <td className={`py-2 pr-3 text-right font-medium ${entry.amountCents >= 0 ? "text-emerald-700" : "text-red-700"}`}>
                  {entry.amountCents >= 0 ? "+" : ""}
                  {formatPriceCents(entry.amountCents, entry.currency)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {ledgerEntries.length === 0 && <p className="py-8 text-center text-slate-500">No ledger activity yet.</p>}
      </div>
    </div>
  );
}
