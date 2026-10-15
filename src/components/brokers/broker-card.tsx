import Link from "next/link";
import { ArrowRight, BadgeCheck, Check, ExternalLink, ShieldCheck, Star } from "lucide-react";
import type { BrokerView } from "@/features/brokers/queries";
import { brokerCta, displayHost, officialLink } from "@/lib/brokers/links";
import { formatRating, isoDay } from "@/lib/brokers/validation";
import { cn } from "@/lib/utils";
import { BrokerLogo } from "./broker-logo";

export function formatDay(value: Date | string): string {
  return new Date(`${isoDay(value)}T00:00:00Z`).toLocaleDateString("en-GB", { timeZone: "UTC", day: "numeric", month: "short", year: "numeric" });
}

const RANK_STYLES = [
  "bg-gradient-to-br from-amber-300 to-amber-500 text-amber-950 shadow-amber-500/30",
  "bg-gradient-to-br from-slate-200 to-slate-400 text-slate-900 shadow-slate-400/30",
  "bg-gradient-to-br from-orange-300 to-orange-500 text-orange-950 shadow-orange-500/30",
];

export function RankBadge({ rank, className }: { rank: number; className?: string }) {
  return (
    <span
      className={cn(
        "flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-full text-base font-bold leading-none shadow-md",
        RANK_STYLES[rank - 1] ?? "bg-slate-100 text-slate-700 shadow-none ring-1 ring-slate-200",
        className,
      )}
      title={`Ranked number ${rank} by FXBotHub`}
    >
      <span className="text-[9px] font-semibold uppercase tracking-wider opacity-70">No.</span>
      {rank}
    </span>
  );
}

export function Rating({ broker }: { broker: Pick<BrokerView, "rating" | "ratingNote"> }) {
  if (broker.rating === null) return <span className="text-xs italic text-slate-400">Not rated</span>;
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap" title={broker.ratingNote ?? undefined}>
      <Star className="h-4 w-4 fill-amber-400 text-amber-400" aria-hidden="true" />
      <span className="text-sm font-semibold text-slate-900">{formatRating(broker.rating)}</span>
      <span className="text-xs text-slate-500">/ 5</span>
      <span className="sr-only"> editorial rating</span>
    </span>
  );
}

function Fact({ label, value, className }: { label: string; value: string | null | undefined; className?: string }) {
  return (
    <div className={className}>
      <dt className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">{label}</dt>
      <dd className={cn("mt-0.5 text-sm", value ? "text-slate-800" : "italic text-slate-400")}>{value || "Not provided"}</dd>
    </div>
  );
}

interface BrokerCardProps {
  broker: BrokerView;
  /** Public ranking (1 = top). Omit for an unranked preview. */
  rank?: number | null;
  /** The dedicated profile page: no "View Details" button, nothing truncated. */
  detail?: boolean;
  /** Admin preview of a not-yet-published listing. */
  preview?: boolean;
}

/** One broker, as the public sees it. Server-rendered, no client JS. */
export function BrokerCard({ broker, rank, detail = false, preview = false }: BrokerCardProps) {
  const cta = brokerCta(broker);
  const official = officialLink(broker);
  const profileHref = `/best-brokers/${broker.slug}`;

  return (
    <article
      id={broker.slug}
      aria-label={broker.name}
      className={cn(
        "group scroll-mt-24 overflow-hidden rounded-2xl border bg-white shadow-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-slate-900/10",
        broker.featured ? "border-amber-300 ring-2 ring-amber-300/60" : "border-slate-200",
      )}
    >
      {broker.featured && (
        <div className="flex items-center gap-1.5 bg-gradient-to-r from-amber-100 via-amber-50 to-white px-5 py-1.5 text-xs font-semibold text-amber-900">
          <BadgeCheck className="h-3.5 w-3.5" aria-hidden="true" /> Featured by FXBotHub
        </div>
      )}

      <div className="flex flex-col gap-5 p-5 sm:p-6">
        {/* Identity row */}
        <div className="flex items-start gap-3 sm:gap-4">
          {rank ? <RankBadge rank={rank} /> : null}
          <BrokerLogo id={broker.id} name={broker.name} hasLogo={Boolean(broker.logoMime)} version={broker.logoUpdatedAt} size="lg" />
          <div className="min-w-0 flex-1">
            <h3 className="text-xl font-semibold leading-snug text-slate-900">
              {detail ? broker.name : <Link href={profileHref} className="hover:text-violet-700 focus-visible:outline-none focus-visible:underline">{broker.name}</Link>}
            </h3>
            {broker.tagline && <p className="mt-0.5 text-sm text-slate-600">{broker.tagline}</p>}
            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5">
              <Rating broker={broker} />
              {cta.isAffiliate && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">Affiliate link</span>}
              {broker.sponsored && <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[11px] font-medium text-violet-800">Sponsored placement</span>}
              {preview && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-900">Preview</span>}
            </div>
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-[1.1fr_1fr]">
          <div className="space-y-4">
            {broker.features.length > 0 && (
              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500">Main features</h4>
                <ul className="mt-2 space-y-1.5">
                  {broker.features.map((feature) => (
                    <li key={feature} className="flex gap-2 text-sm text-slate-700">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" aria-hidden="true" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <div className="rounded-xl bg-slate-50 p-4">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500">Why we selected this broker</h4>
              <p className={cn("mt-1.5 text-sm leading-relaxed text-slate-700", !detail && "line-clamp-4")}>{broker.whySelected}</p>
            </div>
          </div>

          <dl className="grid grid-cols-2 gap-x-4 gap-y-3 content-start">
            <Fact label="Platforms" value={broker.platforms.join(", ") || null} />
            <Fact label="Minimum deposit" value={broker.minDeposit} />
            <Fact label="Account types" value={broker.accountTypes} className="col-span-2" />
            <Fact label="Instruments" value={broker.instruments} className="col-span-2" />
            <Fact label="Spreads and costs" value={broker.spreadsInfo} className="col-span-2" />
            <div className="col-span-2">
              <dt className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" /> Regulation
              </dt>
              <dd className={cn("mt-0.5 text-sm", broker.regulation ? "text-slate-800" : "italic text-slate-400")}>{broker.regulation || "Not provided"}</dd>
            </div>
            <div className="col-span-2">
              <dt className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Best for</dt>
              <dd className="mt-1 flex flex-wrap gap-1.5">
                {broker.bestFor.length > 0 ? (
                  broker.bestFor.map((tag) => (
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
            {broker.infoVerifiedAt ? <>Information checked {formatDay(broker.infoVerifiedAt)}.</> : <>No verification date recorded.</>}{" "}
            {broker.ratingNote && broker.rating !== null && <span>{broker.ratingNote}</span>}
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
