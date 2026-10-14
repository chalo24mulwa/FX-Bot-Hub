import type { Metadata } from "next";
import Link from "next/link";
import { resolveSiteUrl } from "@/lib/site-url";
import { requireApprovedPartnerPage } from "@/features/partnership/guard";
import { getReferralPerformance, listShareableProducts } from "@/features/partnership/queries";
import { CopyLink, ProductLinkBuilder } from "@/components/partnership/forms";
import { StatCard, firstParam } from "@/components/partnership/ui";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Referral links", robots: { index: false, follow: false } };

const RANGES = [7, 30, 90] as const;

export default async function ReferralLinksPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const profile = await requireApprovedPartnerPage();
  const requested = Number(firstParam((await searchParams).days));
  const days = (RANGES as readonly number[]).includes(requested) ? requested : 30;
  const [perf, products] = await Promise.all([getReferralPerformance(profile.id, days), listShareableProducts()]);
  const base = resolveSiteUrl().replace(/\/$/, "");
  const active = profile.status === "APPROVED" && profile.referralCode;
  const max = Math.max(1, ...perf.byDay.map((d) => d.clicks));

  return (
    <div className="min-w-0 space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Referral links</h1>
        <p className="mt-1 text-sm text-slate-600">Anyone who follows these links is tracked for the referral window set in the programme terms.</p>
      </div>

      {active ? (
        <section className="space-y-6 rounded-xl border border-slate-200 bg-white p-5">
          <CopyLink url={`${base}/?ref=${profile.referralCode}`} label="Main referral link (homepage)" />
          <CopyLink url={`${base}/marketplace?ref=${profile.referralCode}`} label="Marketplace link" />
          <div>
            <h2 className="text-sm font-semibold text-slate-900">Link to a specific product</h2>
            <div className="mt-2">
              <ProductLinkBuilder base={base} code={profile.referralCode!} products={products} />
            </div>
          </div>
        </section>
      ) : (
        <p className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">Your links are inactive while your Partnership is suspended.</p>
      )}

      <section aria-labelledby="perf-title">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="perf-title" className="text-lg font-semibold text-slate-900">
            Performance
          </h2>
          <div className="flex gap-1" role="group" aria-label="Date range">
            {RANGES.map((r) => (
              <Link
                key={r}
                href={`/dashboard/partnership/links?days=${r}`}
                aria-current={r === days ? "true" : undefined}
                className={cn("rounded-md border px-3 py-1 text-sm", r === days ? "border-slate-900 bg-slate-900 text-white" : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50")}
              >
                {r} days
              </Link>
            ))}
          </div>
        </div>
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <StatCard label="Referral visits" value={perf.totalClicks} hint="One per visitor per day — refreshes don't count" />
          <StatCard label="Registrations" value={perf.registrations} />
          <StatCard label="Visit → registration" value={perf.conversionPercent === null ? "—" : `${perf.conversionPercent}%`} />
        </div>
        {perf.byDay.length > 0 ? (
          <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200 bg-white p-4">
            <table className="w-full min-w-[320px] text-sm">
              <caption className="sr-only">Referral visits per day</caption>
              <thead>
                <tr className="text-left text-slate-500">
                  <th className="py-1 pr-3 font-medium">Day</th>
                  <th className="py-1 font-medium">Visits</th>
                </tr>
              </thead>
              <tbody>
                {perf.byDay.map((d) => (
                  <tr key={d.day}>
                    <td className="whitespace-nowrap py-1 pr-3 text-slate-600">{d.day}</td>
                    <td className="py-1">
                      <span className="flex items-center gap-2">
                        <span className="h-2 rounded bg-violet-500" style={{ width: `${Math.max(4, (d.clicks / max) * 200)}px` }} aria-hidden="true" />
                        {d.clicks}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="mt-4 text-sm text-slate-500">No referral visits in this period yet.</p>
        )}
      </section>
    </div>
  );
}
