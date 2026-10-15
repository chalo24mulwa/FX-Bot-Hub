import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, ChevronRight, Info, Scale, ShieldAlert } from "lucide-react";
import { listPublishedBrokers } from "@/features/brokers/queries";
import { applyFilter, buildFilters } from "@/lib/brokers/filters";
import { pageMetadata } from "@/lib/seo/site";
import { resolveSiteUrl } from "@/lib/site-url";
import { cn } from "@/lib/utils";
import {
  AFFILIATE_DISCLOSURE,
  FAQ,
  HERO,
  HOW_TO_CHOOSE,
  PAGE_PATH,
  RATING_METHODOLOGY,
  RELATED_LINKS,
  RISK_WARNING,
  SEO_DESCRIPTION,
  SEO_TITLE,
} from "@/content/brokers/content";
import { BrokerCard } from "@/components/brokers/broker-card";
import { ComparisonTable } from "@/components/brokers/comparison-table";

// Rendered per request so a publish, edit or reorder in /admin/brokers is live immediately.
export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export async function generateMetadata(): Promise<Metadata> {
  return {
    // Filtered views canonicalise to the page itself.
    ...pageMetadata({ title: "Best Forex Brokers 2026", description: SEO_DESCRIPTION, path: PAGE_PATH }),
    title: { absolute: SEO_TITLE },
  };
}

const escapeJson = (value: unknown) => JSON.stringify(value).replace(/</g, "\\u003c");

function HeroArt() {
  // Decorative candlesticks — no data, no claim. Hidden from assistive tech.
  const candles = [
    [18, 70, 40, 52, true], [44, 62, 30, 44, true], [70, 66, 36, 50, false], [96, 50, 24, 34, true],
    [122, 56, 30, 40, false], [148, 40, 18, 26, true], [174, 46, 22, 32, false], [200, 30, 10, 18, true],
  ] as const;
  return (
    <svg viewBox="0 0 230 110" className="h-full w-full" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id="bb-up" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#a78bfa" />
          <stop offset="1" stopColor="#7c3aed" />
        </linearGradient>
        <linearGradient id="bb-down" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fcd34d" />
          <stop offset="1" stopColor="#f59e0b" />
        </linearGradient>
      </defs>
      {[20, 45, 70, 95].map((y) => (
        <line key={y} x1="0" x2="230" y1={y} y2={y} stroke="rgba(255,255,255,0.07)" />
      ))}
      {candles.map(([x, top, wickTop, bodyTop, up], i) => (
        <g key={i}>
          <line x1={x + 7} x2={x + 7} y1={wickTop} y2={top + 28} stroke={up ? "#a78bfa" : "#fbbf24"} strokeWidth="1.5" />
          <rect x={x} y={bodyTop} width="14" height={Math.max(top - bodyTop + 14, 12)} rx="2.5" fill={up ? "url(#bb-up)" : "url(#bb-down)"} opacity="0.95" />
        </g>
      ))}
      <polyline points="10,92 40,80 70,84 100,62 130,68 160,48 190,52 222,28" fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="1.5" strokeDasharray="3 4" />
    </svg>
  );
}

export default async function BestBrokersPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const requested = typeof sp.filter === "string" ? sp.filter.slice(0, 60) : undefined;

  const published = await listPublishedBrokers();
  const filters = buildFilters(published);
  const activeKey = filters.some((f) => f.key === requested) ? requested : undefined;
  const shown = applyFilter(published, activeKey);
  // Rank is the broker's place in the full published ranking, so a filtered list never renumbers anyone.
  const ranks = new Map(published.map((b, i) => [b.id, i + 1]));
  const activeFilter = filters.find((f) => f.key === activeKey);

  const site = resolveSiteUrl().replace(/\/$/, "");
  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: site },
        { "@type": "ListItem", position: 2, name: "Best Brokers", item: `${site}${PAGE_PATH}` },
      ],
    },
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: FAQ.map((item) => ({ "@type": "Question", name: item.question, acceptedAnswer: { "@type": "Answer", text: item.answer } })),
    },
    ...(published.length > 0
      ? [
          {
            "@context": "https://schema.org",
            "@type": "ItemList",
            name: "Forex brokers listed on FXBotHub",
            itemListElement: published.map((b, i) => ({ "@type": "ListItem", position: i + 1, name: b.name, url: `${site}${PAGE_PATH}/${b.slug}` })),
          },
        ]
      : []),
  ];

  return (
    <main className="w-full min-w-0 flex-1 bg-slate-50">
      {jsonLd.map((block, i) => (
        <script key={i} type="application/ld+json" dangerouslySetInnerHTML={{ __html: escapeJson(block) }} />
      ))}

      {/* Hero */}
      <section
        className="relative overflow-hidden text-slate-200"
        style={{
          backgroundImage:
            "radial-gradient(55% 60% at 10% 0%, rgba(139,92,246,0.24), transparent 70%), radial-gradient(40% 50% at 95% 10%, rgba(245,158,11,0.14), transparent 70%), linear-gradient(180deg, #080e24 0%, #0a1030 60%, #0c1236 100%)",
        }}
      >
        <div className="mx-auto grid max-w-6xl items-center gap-8 px-4 pb-14 pt-6 sm:px-6 sm:pb-16 lg:grid-cols-[1.35fr_1fr]">
          <div className="lg:col-span-2">
            <nav aria-label="Breadcrumb" className="text-sm text-slate-400">
              <ol className="flex items-center gap-1.5">
                <li><Link href="/" className="hover:text-white">Home</Link></li>
                <li aria-hidden="true"><ChevronRight className="h-3.5 w-3.5" /></li>
                <li aria-current="page" className="text-slate-200">Best Brokers</li>
              </ol>
            </nav>
          </div>
          <div>
            <p className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-medium text-amber-200">
              <Scale className="h-3.5 w-3.5" aria-hidden="true" /> Broker comparison
            </p>
            <h1 className="mt-4 text-balance text-4xl font-bold tracking-tight text-white sm:text-5xl">{HERO.heading}</h1>
            <p className="mt-5 max-w-2xl text-lg leading-relaxed text-slate-300">{HERO.text}</p>
            <div className="mt-7 flex flex-wrap gap-3">
              <a
                href="#rankings"
                className="inline-flex h-12 items-center gap-2 rounded-lg bg-violet-500 px-6 text-sm font-semibold text-white shadow-lg shadow-violet-900/40 transition hover:bg-violet-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-300 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a1030]"
              >
                Compare brokers <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </a>
              <a
                href="#how-to-choose"
                className="inline-flex h-12 items-center rounded-lg border border-white/20 px-6 text-sm font-medium text-slate-100 transition hover:border-white/40 hover:bg-white/5"
              >
                How to choose
              </a>
            </div>
          </div>
          <div className="hidden rounded-2xl border border-white/10 bg-white/[0.03] p-5 backdrop-blur lg:block">
            <div className="aspect-[230/110] w-full"><HeroArt /></div>
            <p className="mt-3 text-center text-xs text-slate-400">Illustration only — not market data</p>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-6xl space-y-14 px-4 py-10 sm:px-6 sm:py-14">
        {/* Rankings */}
        <section id="rankings" aria-labelledby="rankings-heading" className="scroll-mt-24">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 id="rankings-heading" className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">Top-ranked brokers</h2>
              <p className="mt-1 text-sm text-slate-600">
                {published.length > 0
                  ? "In the order set by the FXBotHub team. Rankings are editorial and are not a claim that any broker is the best for everyone."
                  : "Our broker listings are being prepared."}
              </p>
            </div>
            <a href="#rating-method" className="text-sm font-medium text-violet-700 underline underline-offset-4 hover:text-violet-900">How ratings work</a>
          </div>

          <aside className="mt-5 flex gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-relaxed text-amber-950" aria-label="Advertising disclosure">
            <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <p>{AFFILIATE_DISCLOSURE}</p>
          </aside>

          {filters.length > 0 && (
            <nav aria-label="Filter brokers" className="mt-6">
              <ul className="flex flex-wrap gap-2">
                <li>
                  <Link
                    href={`${PAGE_PATH}#rankings`}
                    scroll={false}
                    aria-current={!activeKey ? "page" : undefined}
                    className={cn("inline-flex rounded-full border px-3.5 py-1.5 text-sm font-medium transition", !activeKey ? "border-violet-600 bg-violet-600 text-white" : "border-slate-300 bg-white text-slate-700 hover:border-violet-300 hover:text-violet-800")}
                  >
                    All brokers <span className="ml-1 opacity-70">{published.length}</span>
                  </Link>
                </li>
                {filters.map((f) => (
                  <li key={f.key}>
                    <Link
                      href={`${PAGE_PATH}?filter=${encodeURIComponent(f.key)}#rankings`}
                      scroll={false}
                      aria-current={activeKey === f.key ? "page" : undefined}
                      className={cn("inline-flex rounded-full border px-3.5 py-1.5 text-sm font-medium transition", activeKey === f.key ? "border-violet-600 bg-violet-600 text-white" : "border-slate-300 bg-white text-slate-700 hover:border-violet-300 hover:text-violet-800")}
                    >
                      {f.label} <span className="ml-1 opacity-70">{f.count}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          )}

          {published.length === 0 ? (
            <div className="mt-6 rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center">
              <h3 className="text-lg font-semibold text-slate-900">No brokers published yet</h3>
              <p className="mx-auto mt-2 max-w-xl text-sm text-slate-600">
                We only list brokers whose details we have checked, so this page stays empty until they are. In the meantime, the guide below
                covers what to compare, and the <Link href="/guides" className="font-medium text-violet-700 underline">Guides</Link> explain the basics.
              </p>
            </div>
          ) : (
            <>
              {activeFilter && (
                <p className="mt-5 text-sm text-slate-600">
                  Showing {shown.length} of {published.length} brokers: <strong className="text-slate-900">{activeFilter.label}</strong>.{" "}
                  <Link href={`${PAGE_PATH}#rankings`} scroll={false} className="font-medium text-violet-700 underline">Clear filter</Link>
                </p>
              )}
              <div className="mt-6 space-y-5">
                {shown.map((broker) => (
                  <BrokerCard key={broker.id} broker={broker} rank={ranks.get(broker.id)} />
                ))}
              </div>
            </>
          )}
        </section>

        {/* Comparison */}
        {shown.length > 0 && (
          <section id="compare" aria-labelledby="compare-heading" className="scroll-mt-24">
            <h2 id="compare-heading" className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">Compare side by side</h2>
            <p className="mt-1 text-sm text-slate-600">Only details entered and checked by our team are shown; anything else is marked “Not provided”.</p>
            <div className="mt-5">
              <ComparisonTable brokers={shown} ranks={ranks} />
            </div>
          </section>
        )}

        {/* Rating method */}
        <section id="rating-method" aria-labelledby="rating-heading" className="scroll-mt-24 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 id="rating-heading" className="text-xl font-bold text-slate-900">{RATING_METHODOLOGY.title}</h2>
          <div className="mt-3 max-w-3xl space-y-3 text-sm leading-relaxed text-slate-700">
            {RATING_METHODOLOGY.body.map((p) => <p key={p}>{p}</p>)}
          </div>
        </section>

        {/* How to choose */}
        <section id="how-to-choose" aria-labelledby="choose-heading" className="scroll-mt-24">
          <h2 id="choose-heading" className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">How to choose a forex broker</h2>
          <p className="mt-1 max-w-3xl text-sm text-slate-600">Six things worth checking before you open an account with any broker, listed here or not.</p>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {HOW_TO_CHOOSE.map((item) => (
              <div key={item.title} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <h3 className="text-base font-semibold text-slate-900">{item.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">{item.body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* FAQ */}
        <section id="faq" aria-labelledby="faq-heading" className="scroll-mt-24">
          <h2 id="faq-heading" className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">Frequently asked questions</h2>
          <div className="mt-6 max-w-3xl divide-y divide-slate-200 rounded-2xl border border-slate-200 bg-white shadow-sm">
            {FAQ.map((item) => (
              <details key={item.question} className="group px-5 py-4">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-base font-medium text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500">
                  {item.question}
                  <ChevronRight className="h-4 w-4 shrink-0 text-slate-400 transition group-open:rotate-90" aria-hidden="true" />
                </summary>
                <p className="mt-3 text-sm leading-relaxed text-slate-600">{item.answer}</p>
              </details>
            ))}
          </div>
        </section>

        {/* Related + risk */}
        <section aria-labelledby="related-heading">
          <h2 id="related-heading" className="text-xl font-bold text-slate-900">Keep researching on FXBotHub</h2>
          <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {RELATED_LINKS.map((link) => (
              <li key={link.href}>
                <Link href={link.href} className="block h-full rounded-xl border border-slate-200 bg-white p-4 transition hover:border-violet-300 hover:shadow-md">
                  <span className="text-sm font-semibold text-slate-900">{link.title}</span>
                  <span className="mt-1 block text-xs leading-relaxed text-slate-600">{link.text}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>

        <aside className="flex gap-3 rounded-xl border border-slate-300 bg-white p-4 text-sm leading-relaxed text-slate-700" aria-label="Risk warning">
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" aria-hidden="true" />
          <p>{RISK_WARNING}</p>
        </aside>
      </div>
    </main>
  );
}
