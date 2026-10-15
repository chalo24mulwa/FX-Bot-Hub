import Link from "next/link";
import { ArrowRight, BadgeCheck, Check, ExternalLink, Gift, Tag } from "lucide-react";
import type { VpsView } from "@/features/vps/queries";
import { displayHost } from "@/lib/brokers/links";
import { formatStartingPrice, isOfferActive, officialVpsLink, vpsCta } from "@/lib/vps/present";
import { cn } from "@/lib/utils";
import { formatDay, Rating, RankBadge } from "@/components/brokers/broker-card";
import { VpsCover, VpsLogo } from "./vps-image";

function Fact({ label, value, className, note }: { label: string; value: string | null | undefined; className?: string; note?: string | null }) {
  return (
    <div className={className}>
      <dt className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">{label}</dt>
      <dd className={cn("mt-0.5 text-sm", value ? "text-slate-800" : "italic text-slate-400")}>
        {value || "Not provided"}
        {value && note && <span className="mt-0.5 block text-xs text-slate-500">{note}</span>}
      </dd>
    </div>
  );
}

interface VpsCardProps {
  provider: VpsView;
  /** Public ranking (1 = top). Omit for an unranked preview. */
  rank?: number | null;
  /** The dedicated profile page: no "View Details" button. */
  detail?: boolean;
  /** Admin preview of a not-yet-published listing. */
  preview?: boolean;
}

/** One VPS provider, as the public sees it. Server-rendered, no client JS. */
export function VpsCard({ provider, rank, detail = false, preview = false }: VpsCardProps) {
  const cta = vpsCta(provider);
  const official = officialVpsLink(provider);
  const price = formatStartingPrice(provider);
  const showOffer = (provider.offerText || provider.promoCode) && isOfferActive(provider.offerExpiresAt);
  const latency = provider.latencyInfo && provider.latencySource ? provider.latencyInfo : null;
  const profileHref = `/vps/${provider.slug}`;

  return (
    <article
      id={provider.slug}
      aria-label={provider.name}
      className={cn(
        "group scroll-mt-24 overflow-hidden rounded-2xl border bg-white shadow-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-slate-900/10",
        provider.featured ? "border-amber-300 ring-2 ring-amber-300/60" : "border-slate-200",
      )}
    >
      <div className="relative">
        <VpsCover id={provider.id} name={provider.name} hasCover={Boolean(provider.coverMime)} version={provider.coverUpdatedAt} />
        <div className="absolute inset-x-3 top-3 flex items-start justify-between gap-2">
          {rank ? <RankBadge rank={rank} /> : <span />}
          {provider.featured && (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-300 px-3 py-1 text-xs font-bold uppercase tracking-wide text-amber-950 shadow-md">
              <BadgeCheck className="h-3.5 w-3.5" aria-hidden="true" /> Top Pick
            </span>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-5 p-5 sm:p-6">
        {/* relative z-10: the (positioned) cover banner would otherwise paint over the logo's overlap with it. */}
        <div className="relative z-10 -mt-12 flex items-end gap-3 sm:gap-4">
          <VpsLogo id={provider.id} name={provider.name} hasLogo={Boolean(provider.logoMime)} version={provider.logoUpdatedAt} size="lg" className="shadow-md ring-4 ring-white" />
        </div>
        <div className="-mt-2 min-w-0">
          <h3 className="text-xl font-semibold leading-snug text-slate-900">
            {detail ? provider.name : <Link href={profileHref} className="hover:text-violet-700 focus-visible:outline-none focus-visible:underline">{provider.name}</Link>}
          </h3>
          {provider.headline && <p className="mt-0.5 text-sm text-slate-600">{provider.headline}</p>}
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5">
            <Rating broker={provider} />
            {provider.category && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-700">{provider.category}</span>}
            {cta.isAffiliate && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">Affiliate link</span>}
            {provider.sponsored && <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[11px] font-medium text-violet-800">{provider.disclosureNote || "Sponsored placement"}</span>}
            {!provider.sponsored && provider.disclosureNote && <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[11px] font-medium text-violet-800">{provider.disclosureNote}</span>}
            {preview && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-900">Preview</span>}
          </div>
        </div>

        {showOffer && (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm text-emerald-950" aria-label="Current offer">
            <Gift className="h-4 w-4 shrink-0" aria-hidden="true" />
            {provider.offerText && <span className="font-medium">{provider.offerText}</span>}
            {provider.promoCode && (
              <span className="inline-flex items-center gap-1.5">
                <Tag className="h-3.5 w-3.5" aria-hidden="true" /> Code <code className="rounded bg-white px-1.5 py-0.5 font-mono text-xs font-semibold">{provider.promoCode}</code>
              </span>
            )}
            {provider.offerExpiresAt && <span className="text-xs text-emerald-800">Offer ends {formatDay(provider.offerExpiresAt)}</span>}
          </div>
        )}

        <div className="grid gap-6 md:grid-cols-[1.1fr_1fr]">
          <div className="space-y-4">
            {provider.features.length > 0 && (
              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500">Main features</h4>
                <ul className="mt-2 space-y-1.5">
                  {provider.features.map((feature) => (
                    <li key={feature} className="flex gap-2 text-sm text-slate-700">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" aria-hidden="true" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <div className="rounded-xl bg-slate-50 p-4">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500">Why we recommend this provider</h4>
              <p className={cn("mt-1.5 text-sm leading-relaxed text-slate-700", !detail && "line-clamp-4")}>{provider.whyRecommend}</p>
            </div>
          </div>

          <dl className="grid grid-cols-3 content-start gap-x-4 gap-y-3">
            <Fact label="Starting price" value={price} className="col-span-3" />
            <Fact label="CPU" value={provider.cpu} />
            <Fact label="RAM" value={provider.ram} />
            <Fact label="Storage" value={provider.storage} />
            <Fact label="Operating systems" value={provider.operatingSystems.join(", ") || null} className="col-span-3" />
            <Fact label="Server locations" value={provider.serverLocations.join(", ") || null} className="col-span-3" />
            <Fact label="Trading platforms" value={provider.platforms.join(", ") || null} className="col-span-3" />
            <Fact label="Trial or money-back" value={provider.trialNote} className="col-span-3" />
            <Fact label="Latency" value={latency} note={latency ? `Source: ${provider.latencySource}` : null} className="col-span-3" />
            <div className="col-span-3">
              <dt className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Best for</dt>
              <dd className="mt-1 flex flex-wrap gap-1.5">
                {provider.bestFor.length > 0 ? (
                  provider.bestFor.map((tag) => (
                    <span key={tag} className="rounded-full border border-violet-200 bg-violet-50 px-2.5 py-0.5 text-xs font-medium text-violet-800">
                      {tag}
                    </span>
                  ))
                ) : (
                  <span className="text-sm italic text-slate-400">Not provided</span>
                )}
              </dd>
            </div>
          </dl>
        </div>

        <div className="flex flex-col gap-3 border-t border-slate-100 pt-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-slate-500">
            {provider.infoVerifiedAt ? <>Information checked {formatDay(provider.infoVerifiedAt)}.</> : <>No verification date recorded.</>}{" "}
            {provider.ratingNote && provider.rating !== null && <span>{provider.ratingNote}</span>}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            {!detail && (
              <Link
                href={profileHref}
                className="inline-flex h-11 items-center justify-center gap-1.5 rounded-lg border border-slate-300 bg-white px-4 text-sm font-medium text-slate-800 transition hover:border-slate-400 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
              >
                View Details <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            )}
            <a
              href={cta.href}
              target="_blank"
              rel={cta.rel}
              className="inline-flex h-11 items-center justify-center gap-1.5 rounded-lg bg-gradient-to-r from-violet-600 to-violet-500 px-5 text-sm font-semibold text-white shadow-md shadow-violet-600/25 transition hover:from-violet-500 hover:to-violet-400 hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2"
            >
              {cta.label}
              <ExternalLink className="h-4 w-4" aria-hidden="true" />
              <span className="sr-only">(opens {displayHost(cta.href)} in a new tab{cta.isAffiliate ? ", affiliate link" : ""})</span>
            </a>
          </div>
        </div>
        {official && (
          <p className="-mt-2 text-right text-xs text-slate-500">
            Official website:{" "}
            <a href={official.href} target="_blank" rel={official.rel} className="font-medium text-slate-700 underline decoration-slate-300 underline-offset-2 hover:text-violet-700">
              {displayHost(official.href)}
            </a>
          </p>
        )}
      </div>
    </article>
  );
}
