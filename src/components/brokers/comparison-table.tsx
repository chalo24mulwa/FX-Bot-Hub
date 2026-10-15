import Link from "next/link";
import { ExternalLink } from "lucide-react";
import type { BrokerView } from "@/features/brokers/queries";
import { brokerCta, displayHost } from "@/lib/brokers/links";
import { BrokerLogo } from "./broker-logo";
import { Rating, RankBadge } from "./broker-card";

const NOT_PROVIDED = <span className="italic text-slate-400">Not provided</span>;

/**
 * Side-by-side view of the brokers currently shown. A plain table inside its own horizontal scroller, so a
 * phone scrolls the table, not the page. Ranks are the overall public ranks, not positions in a filtered list.
 */
export function ComparisonTable({ brokers, ranks }: { brokers: BrokerView[]; ranks: Map<string, number> }) {
  return (
    <div className="relative overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm" tabIndex={0} role="region" aria-label="Broker comparison table, scrolls sideways on small screens">
      <table className="w-full min-w-[56rem] border-collapse text-left text-sm">
        <caption className="sr-only">Comparison of the listed forex brokers: rating, platforms, minimum deposit, regulation and best-for categories</caption>
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            <th scope="col" className="px-4 py-3">Broker</th>
            <th scope="col" className="px-4 py-3">Rating</th>
            <th scope="col" className="px-4 py-3">Platforms</th>
            <th scope="col" className="px-4 py-3">Min. deposit</th>
            <th scope="col" className="px-4 py-3">Regulation</th>
            <th scope="col" className="px-4 py-3">Best for</th>
            <th scope="col" className="px-4 py-3 text-right">Link</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {brokers.map((broker) => {
            const cta = brokerCta(broker);
            const rank = ranks.get(broker.id);
            return (
              <tr key={broker.id} className="align-top transition hover:bg-violet-50/40">
                <th scope="row" className="px-4 py-3 font-normal">
                  <div className="flex items-center gap-3">
                    {rank ? <RankBadge rank={rank} className="h-9 w-9 text-sm [&>span]:hidden" /> : null}
                    <BrokerLogo id={broker.id} name={broker.name} hasLogo={Boolean(broker.logoMime)} version={broker.logoUpdatedAt} size="sm" />
                    <div className="min-w-0">
                      <Link href={`/best-brokers/${broker.slug}`} className="font-semibold text-slate-900 hover:text-violet-700">
                        {broker.name}
                      </Link>
                      {broker.featured && <p className="text-[11px] font-medium text-amber-700">Featured</p>}
                    </div>
                  </div>
                </th>
                <td className="px-4 py-3"><Rating broker={broker} /></td>
                <td className="px-4 py-3 text-slate-700">{broker.platforms.join(", ") || NOT_PROVIDED}</td>
                <td className="px-4 py-3 text-slate-700">{broker.minDeposit || NOT_PROVIDED}</td>
                <td className="max-w-[16rem] px-4 py-3 text-slate-700">{broker.regulation || NOT_PROVIDED}</td>
                <td className="px-4 py-3">
                  {broker.bestFor.length > 0 ? (
                    <div className="flex flex-wrap gap-1">
                      {broker.bestFor.map((tag) => (
                        <span key={tag} className="rounded-full bg-violet-50 px-2 py-0.5 text-[11px] font-medium text-violet-800">{tag}</span>
                      ))}
                    </div>
                  ) : (
                    NOT_PROVIDED
                  )}
                </td>
                <td className="px-4 py-3 text-right">
                  <a
                    href={cta.href}
                    target="_blank"
                    rel={cta.rel}
                    className="inline-flex items-center gap-1 whitespace-nowrap rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-violet-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2"
                  >
                    {cta.label} <ExternalLink className="h-3 w-3" aria-hidden="true" />
                    <span className="sr-only">for {broker.name} (opens {displayHost(cta.href)} in a new tab{cta.isAffiliate ? ", affiliate link" : ""})</span>
                  </a>
                  {cta.isAffiliate && <p className="mt-1 text-[10px] text-slate-500">Affiliate link</p>}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
