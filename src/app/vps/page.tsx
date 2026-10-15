import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, ChevronRight, Clock, Gauge, Info, Layers, MonitorSmartphone, PowerOff, ServerCog, ShieldAlert, Wifi } from "lucide-react";
import { listPublishedVps } from "@/features/vps/queries";
import { applyVpsFilter, buildVpsFilters } from "@/lib/vps/filters";
import { pageMetadata } from "@/lib/seo/site";
import { resolveSiteUrl } from "@/lib/site-url";
import { cn } from "@/lib/utils";
import {
  AFFILIATE_DISCLOSURE,
  FAQ,
  HERO,
  PAGE_PATH,
  PROVIDERS_HEADING,
  RATING_METHODOLOGY,
  REALITY_NOTE,
  RELATED_LINKS,
  RISK_WARNING,
  SEO_DESCRIPTION,
  SEO_TITLE,
  WHO_HEADING,
  WHO_ITEMS,
  WHY_HEADING,
  WHY_INTRO,
  WHY_ITEMS,
  type WhyIcon,
} from "@/content/vps/content";
import { VpsCard } from "@/components/vps/vps-card";
import { VpsComparisonTable } from "@/components/vps/vps-comparison-table";

// Rendered per request so a publish, edit or reorder in /admin/vps is live immediately.
export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export async function generateMetadata(): Promise<Metadata> {
  return {
    // Filtered views canonicalise to the page itself.
    ...pageMetadata({ title: "Best Forex VPS Hosting for MT4 & MT5", description: SEO_DESCRIPTION, path: PAGE_PATH }),
    title: { absolute: SEO_TITLE },
  };
}

const escapeJson = (value: unknown) => JSON.stringify(value).replace(/</g, "\\u003c");

const WHY_ICONS: Record<WhyIcon, typeof Clock> = { clock: Clock, wifi: Wifi, gauge: Gauge, power: PowerOff, layers: Layers, remote: MonitorSmartphone };

function HeroArt() {
  // Decorative server rack and network — no data, no claim. Hidden from assistive tech.
  const units = [0, 1, 2, 3];
  return (
    <svg viewBox="0 0 260 200" className="h-full w-full" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id="vps-rack" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#1e2a5c" />
          <stop offset="1" stopColor="#10173a" />
        </linearGradient>
        <linearGradient id="vps-link" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#a78bfa" stopOpacity="0" />
          <stop offset="0.5" stopColor="#a78bfa" />
          <stop offset="1" stopColor="#fbbf24" stopOpacity="0" />
        </linearGradient>
      </defs>
      <rect x="70" y="14" width="120" height="172" rx="10" fill="url(#vps-rack)" stroke="rgba(167,139,250,0.5)" />
      {units.map((i) => (
        <g key={i} transform={`translate(80 ${26 + i * 40})`}>
          <rect width="100" height="32" rx="5" fill="rgba(255,255,255,0.05)" stroke="rgba(255,255,255,0.14)" />
          <rect x="8" y="9" width="46" height="4" rx="2" fill="rgba(255,255,255,0.28)" />
          <rect x="8" y="18" width="30" height="4" rx="2" fill="rgba(255,255,255,0.16)" />
          <circle cx="78" cy="16" r="3" fill="#34d399" />
          <circle cx="88" cy="16" r="3" fill={i % 2 ? "#fbbf24" : "#a78bfa"} />
        </g>
      ))}
      {[40, 100, 160].map((y) => (
        <g key={y}>
          <line x1="0" y1={y} x2="70" y2={y} stroke="url(#vps-link)" strokeWidth="1.5" strokeDasharray="4 5" />
          <circle cx="6" cy={y} r="4" fill="#a78bfa" opacity="0.8" />
          <line x1="190" y1={y} x2="260" y2={y} stroke="url(#vps-link)" strokeWidth="1.5" strokeDasharray="4 5" />
          <circle cx="254" cy={y} r="4" fill="#fbbf24" opacity="0.8" />
        </g>
      ))}
    </svg>
  );
}

export default async function VpsPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const requested = typeof sp.filter === "string" ? sp.filter.slice(0, 80) : undefined;

  const published = await listPublishedVps();
  const filters = buildVpsFilters(published);
  const activeKey = filters.some((f) => f.key === requested) ? requested : undefined;
  const shown = applyVpsFilter(published, activeKey);
  // Rank is the provider's place in the full published ranking, so a filtered list never renumbers anyone.
  const ranks = new Map(published.map((p, i) => [p.id, i + 1]));
  const activeFilter = filters.find((f) => f.key === activeKey);

  const site = resolveSiteUrl().replace(/\/$/, "");
  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: site },
        { "@type": "ListItem", position: 2, name: "VPS", item: `${site}${PAGE_PATH}` },
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
            name: "Forex VPS providers listed on FXBotHub",
            itemListElement: published.map((p, i) => ({ "@type": "ListItem", position: i + 1, name: p.name, url: `${site}${PAGE_PATH}/${p.slug}` })),
          },
        ]
      : []),
  ];

  const chip = (active: boolean) =>
    cn(
      "inline-flex rounded-full border px-3.5 py-1.5 text-sm font-medium transition",
      active ? "border-violet-600 bg-violet-600 text-white" : "border-slate-300 bg-white text-slate-700 hover:border-violet-300 hover:text-violet-800",
    );

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
            "radial-gradient(50% 70% at 12% 0%, rgba(139,92,246,0.26), transparent 70%), radial-gradient(40% 55% at 92% 20%, rgba(245,158,11,0.13), transparent 70%), linear-gradient(180deg, #060b1f 0%, #0a1030 65%, #0c1236 100%)",
        }}
      >
        <div className="mx-auto grid max-w-6xl items-center gap-8 px-4 pb-14 pt-6 sm:px-6 sm:pb-16 lg:grid-cols-[1.35fr_1fr]">
          <div className="lg:col-span-2">
            <nav aria-label="Breadcrumb" className="text-sm text-slate-400">
              <ol className="flex items-center gap-1.5">
                <li><Link href="/" className="hover:text-white">Home</Link></li>
                <li aria-hidden="true"><ChevronRight className="h-3.5 w-3.5" /></li>
                <li aria-current="page" className="text-slate-200">VPS</li>
              </ol>
            </nav>
          </div>
          <div>
            <p className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-medium text-amber-200">
              <ServerCog className="h-3.5 w-3.5" aria-hidden="true" /> Forex VPS hosting
            </p>
            <h1 className="mt-4 text-balance text-4xl font-bold tracking-tight text-white sm:text-5xl">{HERO.heading}</h1>
            <p className="mt-5 max-w-2xl text-lg leading-relaxed text-slate-300">{HERO.text}</p>
            <div className="mt-7 flex flex-wrap gap-3">
              <a
                href="#providers"
                className="inline-flex h-12 items-center gap-2 rounded-lg bg-violet-500 px-6 text-sm font-semibold text-white shadow-lg shadow-violet-900/40 transition hover:bg-violet-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-300 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a1030]"
              >
                {HERO.primaryCta} <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </a>
              <a
                href="#why-vps"
                className="inline-flex h-12 items-center rounded-lg border border-white/20 px-6 text-sm font-medium text-slate-100 transition hover:border-white/40 hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-300"
              >
                {HERO.secondaryCta}
              </a>
            </div>
          </div>
          <div className="hidden rounded-2xl border border-white/10 bg-white/[0.03] p-6 backdrop-blur lg:block">
            <div className="aspect-[260/200] w-full"><HeroArt /></div>
            <p className="mt-3 text-center text-xs text-slate-400">Illustration only</p>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-6xl space-y-14 px-4 py-10 sm:px-6 sm:py-14">
        {/* Why a VPS */}
        <section id="why-vps" aria-labelledby="why-heading" className="scroll-mt-24">
          <h2 id="why-heading" className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">{WHY_HEADING}</h2>
          <p className="mt-1 max-w-3xl text-sm text-slate-600">{WHY_INTRO}</p>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {WHY_ITEMS.map((item) => {
              const Icon = WHY_ICONS[item.icon];
              return (
                <div key={item.title} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-50 text-violet-700">
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <h3 className="mt-3 text-base font-semibold text-slate-900">{item.title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-slate-600">{item.text}</p>
                </div>
              );
            })}
          </div>

          <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_1.2fr]">
            <div>
              <h3 className="text-xl font-bold text-slate-900">{WHO_HEADING}</h3>
              <ul className="mt-3 space-y-3">
                {WHO_ITEMS.map((item) => (
                  <li key={item.title} className="text-sm leading-relaxed text-slate-600">
                    <strong className="font-semibold text-slate-900">{item.title}.</strong> {item.text}
                  </li>
                ))}
              </ul>
            </div>
            <aside className="flex gap-3 self-start rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-relaxed text-amber-950" aria-label="What a VPS can and cannot do">
              <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              <p>{REALITY_NOTE}</p>
            </aside>
          </div>
        </section>

        {/* Providers */}
        <section id="providers" aria-labelledby="providers-heading" className="scroll-mt-24">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 id="providers-heading" className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">{PROVIDERS_HEADING}</h2>
              <p className="mt-1 text-sm text-slate-600">
                {published.length > 0
                  ? "In the order set by the FXBotHub team. Rankings are editorial and are not a claim that any provider is the best for everyone."
                  : "Our VPS listings are being prepared."}
              </p>
            </div>
            <a href="#rating-method" className="text-sm font-medium text-violet-700 underline underline-offset-4 hover:text-violet-900">How ratings work</a>
          </div>

          <aside className="mt-5 flex gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-relaxed text-amber-950" aria-label="Advertising disclosure">
            <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <p>{AFFILIATE_DISCLOSURE}</p>
          </aside>

          {filters.length > 0 && (
            <nav aria-label="Filter VPS providers" className="mt-6">
              <ul className="flex flex-wrap gap-2">
                <li>
                  <Link href={`${PAGE_PATH}#providers`} scroll={false} aria-current={!activeKey ? "page" : undefined} className={chip(!activeKey)}>
                    All providers <span className="ml-1 opacity-70">{published.length}</span>
                  </Link>
                </li>
                {filters.map((f) => (
                  <li key={f.key}>
                    <Link href={`${PAGE_PATH}?filter=${encodeURIComponent(f.key)}#providers`} scroll={false} aria-current={activeKey === f.key ? "page" : undefined} className={chip(activeKey === f.key)}>
                      {f.label} <span className="ml-1 opacity-70">{f.count}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          )}

          {published.length === 0 ? (
            <div className="mt-6 rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center">
              <h3 className="text-lg font-semibold text-slate-900">No VPS providers published yet</h3>
              <p className="mx-auto mt-2 max-w-xl text-sm text-slate-600">
                We only list providers whose details we have checked, so this section stays empty until they are. In the meantime, the{" "}
                <Link href="/guides" className="font-medium text-violet-700 underline">Guides</Link> and{" "}
                <Link href="/tutorials" className="font-medium text-violet-700 underline">Tutorials</Link> explain how EAs run on MetaTrader.
              </p>
            </div>
          ) : (
            <>
              {activeFilter && (
                <p className="mt-5 text-sm text-slate-600">
                  Showing {shown.length} of {published.length} providers: <strong className="text-slate-900">{activeFilter.label}</strong>.{" "}
                  <Link href={`${PAGE_PATH}#providers`} scroll={false} className="font-medium text-violet-700 underline">Clear filter</Link>
                </p>
              )}
              <div className="mt-6 space-y-6">
                {shown.map((provider) => (
                  <VpsCard key={provider.id} provider={provider} rank={ranks.get(provider.id)} />
                ))}
              </div>
            </>
          )}
        </section>

        {shown.length > 0 && (
          <section id="compare" aria-labelledby="compare-heading" className="scroll-mt-24">
            <h2 id="compare-heading" className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">Compare side by side</h2>
            <p className="mt-1 text-sm text-slate-600">Only details entered and checked by our team are shown; anything else is marked “Not provided”.</p>
            <div className="mt-5">
              <VpsComparisonTable providers={shown} ranks={ranks} />
            </div>
          </section>
        )}

        <section id="rating-method" aria-labelledby="rating-heading" className="scroll-mt-24 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 id="rating-heading" className="text-xl font-bold text-slate-900">{RATING_METHODOLOGY.title}</h2>
          <div className="mt-3 max-w-3xl space-y-3 text-sm leading-relaxed text-slate-700">
            {RATING_METHODOLOGY.body.map((p) => <p key={p}>{p}</p>)}
          </div>
        </section>

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

        <section aria-labelledby="related-heading">
          <h2 id="related-heading" className="text-xl font-bold text-slate-900">Keep going on FXBotHub</h2>
          <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
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
