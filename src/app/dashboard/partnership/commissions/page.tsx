import type { Metadata } from "next";
import Link from "next/link";
import { requireApprovedPartnerPage } from "@/features/partnership/guard";
import { PAGE_SIZE, listMyCommissions } from "@/features/partnership/queries";
import { EmptyState, Pager, StatusPill, TIER_LABEL, fmtDate, firstParam, parsePage } from "@/components/partnership/ui";
import { formatMoney, formatRate } from "@/lib/partnership/rules";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Commissions", robots: { index: false, follow: false } };

const STATUSES = ["PENDING", "APPROVED", "PAID", "REVERSED", "REJECTED"];
const STATUS_HELP: Record<string, string> = {
  PENDING: "Payment verified; in the holding period.",
  APPROVED: "Holding period over — available for payout.",
  PAID: "Included in a payout that has been sent.",
  REVERSED: "The order was refunded or charged back.",
  REJECTED: "Rejected after review — see the reason.",
};

export default async function CommissionsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const profile = await requireApprovedPartnerPage();
  const sp = await searchParams;
  const status = STATUSES.includes(firstParam(sp.status)) ? firstParam(sp.status) : "";
  const type = ["PARTNER", "MASTER_PARTNER"].includes(firstParam(sp.type)) ? firstParam(sp.type) : "";
  const page = parsePage(sp.page);
  const { items, total } = await listMyCommissions(profile.id, { status, type, page });
  const href = (over: { status?: string; type?: string; page?: number }) => {
    const p = new URLSearchParams();
    const s = over.status ?? status;
    const t = over.type ?? type;
    if (s) p.set("status", s);
    if (t) p.set("type", t);
    if (over.page && over.page > 1) p.set("page", String(over.page));
    const qs = p.toString();
    return `/dashboard/partnership/commissions${qs ? `?${qs}` : ""}`;
  };
  const chip = (active: boolean) => cn("rounded-full border px-3 py-1 text-xs", active ? "border-slate-900 bg-slate-900 text-white" : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50");

  return (
    <div className="min-w-0">
      <h1 className="text-2xl font-semibold text-slate-900">Commissions</h1>
      <p className="mt-1 text-sm text-slate-600">Every commission shows exactly how it was calculated: the eligible amount, the rate in force on the day of the sale, and the result.</p>

      <div className="mt-4 flex flex-wrap gap-2" role="group" aria-label="Filter by status">
        <Link href={href({ status: "", page: 1 })} className={chip(!status)}>
          All statuses
        </Link>
        {STATUSES.map((s) => (
          <Link key={s} href={href({ status: s, page: 1 })} className={chip(status === s)} title={STATUS_HELP[s]}>
            {s.charAt(0) + s.slice(1).toLowerCase()}
          </Link>
        ))}
      </div>
      {(profile.masterStatus === "APPROVED" || profile.masterStatus === "SUSPENDED") && (
        <div className="mt-2 flex flex-wrap gap-2" role="group" aria-label="Filter by type">
          <Link href={href({ type: "", page: 1 })} className={chip(!type)}>
            All types
          </Link>
          <Link href={href({ type: "PARTNER", page: 1 })} className={chip(type === "PARTNER")}>
            Partner (own referrals)
          </Link>
          <Link href={href({ type: "MASTER_PARTNER", page: 1 })} className={chip(type === "MASTER_PARTNER")}>
            Master Partner (recruits&apos; sales)
          </Link>
        </div>
      )}

      {items.length === 0 ? (
        <div className="mt-6">
          <EmptyState title="No commissions here yet.">Commission appears once a referred purchase has been paid and verified.</EmptyState>
        </div>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="bg-slate-50 text-left text-slate-500">
              <tr>
                <th className="px-4 py-2 font-medium">Date</th>
                <th className="px-4 py-2 font-medium">Product</th>
                <th className="px-4 py-2 font-medium">Type</th>
                <th className="px-4 py-2 font-medium">Calculation</th>
                <th className="px-4 py-2 font-medium">Commission</th>
                <th className="px-4 py-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.map((c) => (
                <tr key={c.id} className="align-top">
                  <td className="whitespace-nowrap px-4 py-2 text-slate-600">{fmtDate(c.createdAt)}</td>
                  <td className="px-4 py-2 text-slate-800">{c.orderItem.product.name}</td>
                  <td className="px-4 py-2 text-slate-600">{TIER_LABEL[c.type]}</td>
                  <td className="whitespace-nowrap px-4 py-2 text-slate-600">
                    {formatMoney(c.basisCents, c.currency)} × {formatRate(c.rateBps)}
                  </td>
                  <td className="px-4 py-2 font-medium text-slate-900">{formatMoney(c.amountCents, c.currency)}</td>
                  <td className="px-4 py-2">
                    <StatusPill status={c.status} />
                    <p className="mt-1 max-w-[16rem] text-xs text-slate-500">
                      {c.status === "PENDING" ? `Available from ${fmtDate(c.holdUntil)} if not refunded.` : c.statusReason ?? STATUS_HELP[c.status]}
                    </p>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Pager page={page} total={total} pageSize={PAGE_SIZE} href={(p) => href({ page: p })} />
    </div>
  );
}
