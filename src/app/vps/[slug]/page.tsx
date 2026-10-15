import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Check, ChevronRight, Info, ShieldAlert, TriangleAlert } from "lucide-react";
import { getPublishedVps, listPublishedVps } from "@/features/vps/queries";
import { pageMetadata } from "@/lib/seo/site";
import { resolveSiteUrl } from "@/lib/site-url";
import { vpsCta } from "@/lib/vps/present";
import { AFFILIATE_DISCLOSURE, PAGE_PATH, REALITY_NOTE, RISK_WARNING } from "@/content/vps/content";
import { VpsCard } from "@/components/vps/vps-card";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ slug: string }>;
}

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function clip(text: string, max: number) {
  const flat = text.replace(/\s+/g, " ").trim();
  return flat.length <= max ? flat : `${flat.slice(0, max - 1).trimEnd()}…`;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const provider = SLUG.test(slug) ? await getPublishedVps(slug) : null;
  if (!provider) return { title: "VPS provider not found", robots: { index: false, follow: false } };
  const meta = pageMetadata({
    title: provider.seoTitle ?? `${provider.name} — VPS for Forex Trading`,
    description: provider.seoDescription ?? clip(`${provider.name}: ${provider.headline ?? provider.whyRecommend}`, 155),
    path: `${PAGE_PATH}/${provider.slug}`,
  });
  // A provider's own SEO title is used as written (not suffixed twice).
  return provider.seoTitle ? { ...meta, title: { absolute: `${provider.seoTitle} | FXBotHub` } } : meta;
}

export default async function VpsProfilePage({ params }: PageProps) {
  const { slug } = await params;
  if (!SLUG.test(slug)) notFound();
  const [provider, published] = await Promise.all([getPublishedVps(slug), listPublishedVps()]);
  if (!provider) notFound();

  const rank = published.findIndex((p) => p.id === provider.id) + 1;
  const site = resolveSiteUrl().replace(/\/$/, "");
  const breadcrumb = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: site },
      { "@type": "ListItem", position: 2, name: "VPS", item: `${site}${PAGE_PATH}` },
      { "@type": "ListItem", position: 3, name: provider.name, item: `${site}${PAGE_PATH}/${provider.slug}` },
    ],
  };
  const others = published.filter((p) => p.id !== provider.id).slice(0, 4);
  const cta = vpsCta(provider);

  return (
    <main className="w-full min-w-0 flex-1 bg-slate-50">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumb).replace(/</g, "\\u003c") }} />
      <section className="text-slate-200" style={{ backgroundImage: "linear-gradient(180deg, #060b1f 0%, #0c1236 100%)" }}>
        <div className="mx-auto max-w-5xl px-4 pb-10 pt-6 sm:px-6">
          <nav aria-label="Breadcrumb" className="text-sm text-slate-400">
            <ol className="flex flex-wrap items-center gap-1.5">
              <li><Link href="/" className="hover:text-white">Home</Link></li>
              <li aria-hidden="true"><ChevronRight className="h-3.5 w-3.5" /></li>
              <li><Link href={PAGE_PATH} className="hover:text-white">VPS</Link></li>
              <li aria-hidden="true"><ChevronRight className="h-3.5 w-3.5" /></li>
              <li aria-current="page" className="text-slate-200">{provider.name}</li>
            </ol>
          </nav>
          <h1 className="mt-6 text-3xl font-bold tracking-tight text-white sm:text-4xl">{provider.name}</h1>
          <p className="mt-2 max-w-2xl text-slate-300">{provider.headline ?? "VPS provider profile, as entered and checked by the FXBotHub team."}</p>
        </div>
      </section>

      <div className="mx-auto max-w-5xl space-y-8 px-4 py-10 sm:px-6">
        <VpsCard provider={provider} rank={rank || null} detail />

        {provider.description && (
          <section aria-labelledby="about-heading" className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 id="about-heading" className="text-lg font-bold text-slate-900">About {provider.name}</h2>
            <div className="mt-3 max-w-3xl space-y-3 text-sm leading-relaxed text-slate-700">
              {provider.description.split(/\n{2,}/).map((p) => <p key={p}>{p}</p>)}
            </div>
            {provider.otherSpecs && (
              <p className="mt-4 text-sm text-slate-700"><strong className="font-semibold text-slate-900">More specifications:</strong> {provider.otherSpecs}</p>
            )}
          </section>
        )}

        {(provider.advantages.length > 0 || provider.limitations.length > 0) && (
          <div className="grid gap-6 md:grid-cols-2">
            {provider.advantages.length > 0 && (
              <section aria-labelledby="adv-heading" className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <h2 id="adv-heading" className="text-lg font-bold text-slate-900">Key advantages</h2>
                <ul className="mt-3 space-y-2">
                  {provider.advantages.map((a) => (
                    <li key={a} className="flex gap-2 text-sm text-slate-700">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" aria-hidden="true" /> <span>{a}</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}
            {provider.limitations.length > 0 && (
              <section aria-labelledby="lim-heading" className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <h2 id="lim-heading" className="text-lg font-bold text-slate-900">Limitations to consider</h2>
                <ul className="mt-3 space-y-2">
                  {provider.limitations.map((l) => (
                    <li key={l} className="flex gap-2 text-sm text-slate-700">
                      <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" aria-hidden="true" /> <span>{l}</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>
        )}

        <aside className="flex gap-3 rounded-xl border border-slate-300 bg-white p-4 text-sm leading-relaxed text-slate-700" aria-label="What a VPS can and cannot do">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" aria-hidden="true" />
          <p>{REALITY_NOTE}</p>
        </aside>

        {cta.isAffiliate && (
          <aside className="flex gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-relaxed text-amber-950" aria-label="Advertising disclosure">
            <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <p>{AFFILIATE_DISCLOSURE}</p>
          </aside>
        )}

        {others.length > 0 && (
          <section aria-labelledby="others-heading">
            <h2 id="others-heading" className="text-lg font-bold text-slate-900">Other VPS providers on FXBotHub</h2>
            <ul className="mt-3 grid gap-3 sm:grid-cols-2">
              {others.map((p) => (
                <li key={p.id}>
                  <Link href={`${PAGE_PATH}/${p.slug}`} className="block rounded-xl border border-slate-200 bg-white p-4 transition hover:border-violet-300 hover:shadow-md">
                    <span className="text-sm font-semibold text-slate-900">{p.name}</span>
                    {p.headline && <span className="mt-0.5 block text-xs text-slate-600">{p.headline}</span>}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        <Link href={`${PAGE_PATH}#providers`} className="inline-flex items-center gap-1.5 text-sm font-medium text-violet-700 hover:text-violet-900">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Back to the comparison
        </Link>

        <aside className="flex gap-3 rounded-xl border border-slate-300 bg-white p-4 text-sm leading-relaxed text-slate-700" aria-label="Risk warning">
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" aria-hidden="true" />
          <p>{RISK_WARNING}</p>
        </aside>
      </div>
    </main>
  );
}
