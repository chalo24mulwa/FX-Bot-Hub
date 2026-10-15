import Link from "next/link";
import { ExternalLink } from "lucide-react";
import type { VpsView } from "@/features/vps/queries";
import { displayHost } from "@/lib/brokers/links";
import { formatStartingPrice, vpsCta } from "@/lib/vps/present";
import { Rating, RankBadge } from "@/components/brokers/broker-card";
import { VpsLogo } from "./vps-image";

const NOT_PROVIDED = <span className="italic text-slate-400">Not provided</span>;

/**
 * Side-by-side view of the providers currently shown. A plain table inside its own horizontal scroller, so a
 * phone scrolls the table, not the page. The scroller is `relative`: the `sr-only` link text is absolutely
 * positioned and would otherwise escape the clip and widen the whole page. Ranks are the overall public ranks.
 */
export function VpsComparisonTable({ providers, ranks }: { providers: VpsView[]; ranks: Map<string, number> }) {
  return (
    <div className="relative overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm" tabIndex={0} role="region" aria-label="VPS comparison table, scrolls sideways on small screens">
      <table className="w-full min-w-[60rem] border-collapse text-left text-sm">
        <caption className="sr-only">Comparison of the listed VPS providers: rating, starting price, operating systems, server locations, platforms and trial offers</caption>
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            <th scope="col" className="px-4 py-3">Provider</th>
            <th scope="col" className="px-4 py-3">Rating</th>
            <th scope="col" className="px-4 py-3">Starting price</th>
            <th scope="col" className="px-4 py-3">Operating systems</th>
            <th scope="col" className="px-4 py-3">Server locations</th>
            <th scope="col" className="px-4 py-3">Platforms</th>
            <th scope="col" className="px-4 py-3">Trial</th>
            <th scope="col" className="px-4 py-3 text-right">Link</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {providers.map((p) => {
            const cta = vpsCta(p);
            const rank = ranks.get(p.id);
            return (
              <tr key={p.id} className="align-top transition hover:bg-violet-50/40">
                <th scope="row" className="px-4 py-3 font-normal">
                  <div className="flex items-center gap-3">
                    {rank ? <RankBadge rank={rank} className="h-9 w-9 text-sm [&>span]:hidden" /> : null}
                    <VpsLogo id={p.id} name={p.name} hasLogo={Boolean(p.logoMime)} version={p.logoUpdatedAt} size="sm" />
                    <div className="min-w-0">
                      <Link href={`/vps/${p.slug}`} className="font-semibold text-slate-900 hover:text-violet-700">
                        {p.name}
                      </Link>
                      {p.featured && <p className="text-[11px] font-semibold text-amber-700">Top Pick</p>}
                    </div>
                  </div>
                </th>
                <td className="whitespace-nowrap px-4 py-3"><Rating broker={p} /></td>
                <td className="whitespace-nowrap px-4 py-3 text-slate-700">{formatStartingPrice(p) ?? NOT_PROVIDED}</td>
                <td className="px-4 py-3 text-slate-700">{p.operatingSystems.join(", ") || NOT_PROVIDED}</td>
                <td className="max-w-[14rem] px-4 py-3 text-slate-700">{p.serverLocations.join(", ") || NOT_PROVIDED}</td>
                <td className="px-4 py-3 text-slate-700">{p.platforms.join(", ") || NOT_PROVIDED}</td>
                <td className="max-w-[12rem] px-4 py-3 text-slate-700">{p.trialNote || NOT_PROVIDED}</td>
                <td className="px-4 py-3 text-right">
                  <a
                    href={cta.href}
                    target="_blank"
                    rel={cta.rel}
                    className="inline-flex items-center gap-1 whitespace-nowrap rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-violet-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2"
                  >
                    {cta.label} <ExternalLink className="h-3 w-3" aria-hidden="true" />
                    <span className="sr-only">for {p.name} (opens {displayHost(cta.href)} in a new tab{cta.isAffiliate ? ", affiliate link" : ""})</span>
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
