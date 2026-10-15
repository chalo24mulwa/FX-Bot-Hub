import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ChevronRight, Info, ShieldAlert } from "lucide-react";
import { getPublishedBroker, listPublishedBrokers } from "@/features/brokers/queries";
import { pageMetadata } from "@/lib/seo/site";
import { resolveSiteUrl } from "@/lib/site-url";
import { AFFILIATE_DISCLOSURE, PAGE_PATH, RISK_WARNING } from "@/content/brokers/content";
import { BrokerCard } from "@/components/brokers/broker-card";
import { brokerCta } from "@/lib/brokers/links";

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
  const broker = SLUG.test(slug) ? await getPublishedBroker(slug) : null;
  if (!broker) return { title: "Broker not found", robots: { index: false, follow: false } };
  return pageMetadata({
    title: `${broker.name} — Broker Profile`,
    description: clip(`${broker.name}: ${broker.tagline ?? broker.whySelected}`, 155),
    path: `${PAGE_PATH}/${broker.slug}`,
  });
}

export default async function BrokerProfilePage({ params }: PageProps) {
  const { slug } = await params;
  if (!SLUG.test(slug)) notFound();
  const [broker, published] = await Promise.all([getPublishedBroker(slug), listPublishedBrokers()]);
  if (!broker) notFound();

  const rank = published.findIndex((b) => b.id === broker.id) + 1;
  const site = resolveSiteUrl().replace(/\/$/, "");
  const breadcrumb = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: site },
      { "@type": "ListItem", position: 2, name: "Best Brokers", item: `${site}${PAGE_PATH}` },
      { "@type": "ListItem", position: 3, name: broker.name, item: `${site}${PAGE_PATH}/${broker.slug}` },
    ],
  };
  const others = published.filter((b) => b.id !== broker.id).slice(0, 4);
  const cta = brokerCta(broker);

  return (
    <main className="w-full min-w-0 flex-1 bg-slate-50">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumb).replace(/</g, "\\u003c") }} />
      <section className="text-slate-200" style={{ backgroundImage: "linear-gradient(180deg, #080e24 0%, #0c1236 100%)" }}>
        <div className="mx-auto max-w-5xl px-4 pb-10 pt-6 sm:px-6">
          <nav aria-label="Breadcrumb" className="text-sm text-slate-400">
            <ol className="flex flex-wrap items-center gap-1.5">
              <li><Link href="/" className="hover:text-white">Home</Link></li>
              <li aria-hidden="true"><ChevronRight className="h-3.5 w-3.5" /></li>
              <li><Link href={PAGE_PATH} className="hover:text-white">Best Brokers</Link></li>
              <li aria-hidden="true"><ChevronRight className="h-3.5 w-3.5" /></li>
              <li aria-current="page" className="text-slate-200">{broker.name}</li>
            </ol>
          </nav>
          <h1 className="mt-6 text-3xl font-bold tracking-tight text-white sm:text-4xl">{broker.name}</h1>
          <p className="mt-2 max-w-2xl text-slate-300">{broker.tagline ?? "Broker profile, as entered and checked by the FXBotHub team."}</p>
        </div>
      </section>

      <div className="mx-auto max-w-5xl space-y-8 px-4 py-10 sm:px-6">
        <BrokerCard broker={broker} rank={rank || null} detail />

        {cta.isAffiliate && (
          <aside className="flex gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-relaxed text-amber-950" aria-label="Advertising disclosure">
            <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <p>{AFFILIATE_DISCLOSURE}</p>
          </aside>
        )}

        {others.length > 0 && (
          <section aria-labelledby="others-heading">
            <h2 id="others-heading" className="text-lg font-bold text-slate-900">Other brokers on FXBotHub</h2>
            <ul className="mt-3 grid gap-3 sm:grid-cols-2">
              {others.map((b) => (
                <li key={b.id}>
                  <Link href={`${PAGE_PATH}/${b.slug}`} className="block rounded-xl border border-slate-200 bg-white p-4 transition hover:border-violet-300 hover:shadow-md">
                    <span className="text-sm font-semibold text-slate-900">{b.name}</span>
                    {b.tagline && <span className="mt-0.5 block text-xs text-slate-600">{b.tagline}</span>}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        <Link href={`${PAGE_PATH}#rankings`} className="inline-flex items-center gap-1.5 text-sm font-medium text-violet-700 hover:text-violet-900">
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
