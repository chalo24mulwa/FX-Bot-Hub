import Link from "next/link";
import { db } from "@/lib/db";
import { getLedgerTotals, listOutstandingSellerBalances } from "@/repositories/ledger-repository";
import { formatPriceCents, cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

const RANGE_PRESETS: { value: string; label: string; days: number | null }[] = [
  { value: "today", label: "Today", days: 1 },
  { value: "7d", label: "7 days", days: 7 },
  { value: "30d", label: "30 days", days: 30 },
  { value: "month", label: "This month", days: null },
  { value: "year", label: "This year", days: null },
  { value: "all", label: "All time", days: null },
];

function getRange(preset: string): { from?: Date; to?: Date } {
  const now = new Date();
  switch (preset) {
    case "today":
      return { from: new Date(now.getFullYear(), now.getMonth(), now.getDate()) };
    case "7d":
      return { from: new Date(now.getTime() - 7 * 86_400_000) };
    case "30d":
      return { from: new Date(now.getTime() - 30 * 86_400_000) };
    case "month":
      return { from: new Date(now.getFullYear(), now.getMonth(), 1) };
    case "year":
      return { from: new Date(now.getFullYear(), 0, 1) };
    default:
      return {};
  }
}

interface FinancePageProps {
  searchParams: Promise<{ range?: string }>;
}

export default async function AdminFinancePage({ searchParams }: FinancePageProps) {
  const params = await searchParams;
  const preset = RANGE_PRESETS.some((p) => p.value === params.range) ? params.range! : "30d";
  const range = getRange(preset);

  const [totals, outstandingBalances, activeSubscriptions, pendingRefunds, pendingPayouts] = await Promise.all([
    getLedgerTotals(range),
    listOutstandingSellerBalances(),
    db.subscription.count({ where: { status: { in: ["ACTIVE", "TRIAL"] } } }),
    db.refund.count({ where: { status: "REQUESTED" } }),
    db.payout.count({ where: { status: { in: ["PENDING", "PROCESSING"] } } }),
  ]);

  const netMarketplaceRevenue = totals.commissionCents;
  const sellerRevenue = totals.salesCents - totals.commissionCents;
  const totalOutstanding = outstandingBalances.reduce((sum, b) => sum + b.balanceCents, 0);

  return (
    <div>
      <h1 className="text-2xl font-semibold text-slate-900">Finance</h1>

      <div className="mt-4 flex flex-wrap gap-2">
        {RANGE_PRESETS.map((p) => (
          <Link
            key={p.value}
            href={`/admin/finance?range=${p.value}`}
            className={cn(
              "rounded-full px-3 py-1.5 text-sm font-medium",
              preset === p.value ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            )}
          >
            {p.label}
          </Link>
        ))}
      </div>

      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        <Stat label="Gross sales" value={formatPriceCents(totals.salesCents, "USD")} />
        <Stat label="Net marketplace revenue" value={formatPriceCents(netMarketplaceRevenue, "USD")} />
        <Stat label="Seller revenue" value={formatPriceCents(sellerRevenue, "USD")} />
        <Stat label="Commissions collected" value={formatPriceCents(totals.commissionCents, "USD")} />
        <Stat label="Refunds" value={formatPriceCents(totals.refundCents, "USD")} />
        <Stat label="Payouts sent" value={formatPriceCents(totals.payoutCents, "USD")} />
        <Stat label="Active subscriptions" value={String(activeSubscriptions)} />
        <Stat label="Outstanding seller balances" value={formatPriceCents(totalOutstanding, "USD")} />
      </div>

      <div className="mt-4 flex flex-wrap gap-3 text-sm">
        {pendingRefunds > 0 && (
          <Link href="/admin/refunds" className="text-blue-600 hover:underline">
            {pendingRefunds} refund{pendingRefunds === 1 ? "" : "s"} awaiting review
          </Link>
        )}
        {pendingPayouts > 0 && (
          <Link href="/admin/payouts" className="text-blue-600 hover:underline">
            {pendingPayouts} payout{pendingPayouts === 1 ? "" : "s"} pending
          </Link>
        )}
      </div>

      <h2 className="mt-10 text-lg font-semibold text-slate-900">Outstanding seller balances</h2>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[520px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-slate-500">
              <th className="py-2 pr-3">Seller</th>
              <th className="py-2 pr-3">Email</th>
              <th className="py-2 pr-3 text-right">Balance</th>
            </tr>
          </thead>
          <tbody>
            {outstandingBalances.map((b) => (
              <tr key={b.sellerId} className="border-b border-slate-100">
                <td className="py-2 pr-3 font-medium text-slate-900">
                  {b.seller?.sellerProfile?.displayName ?? b.seller?.name ?? "—"}
                </td>
                <td className="py-2 pr-3 text-slate-500">{b.seller?.email}</td>
                <td className="py-2 pr-3 text-right text-slate-600">{formatPriceCents(b.balanceCents, "USD")}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {outstandingBalances.length === 0 && <p className="py-8 text-center text-slate-500">No outstanding balances.</p>}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-slate-200 p-4">
      <p className="text-xs text-slate-400">{label}</p>
      <p className="mt-1 text-xl font-semibold text-slate-900">{value}</p>
    </div>
  );
}
