import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertTriangle, ArrowRight, CalendarDays, ChevronRight, Clock } from "lucide-react";
import { GUIDES, getCategory, getGuide, relatedGuides } from "@/content/guides";
import { GuideBody, GuideText } from "@/components/guides/guide-content";
import { GuideCard } from "@/components/guides/guide-card";
import { TutorialCard } from "@/components/tutorials/tutorial-meta";
import { getTutorial } from "@/content/tutorials";
import type { Tutorial } from "@/content/tutorials/types";
import { DEFAULT_OG_IMAGE, SITE_NAME } from "@/lib/seo/site";
import { resolveSiteUrl } from "@/lib/site-url";
import { headingId } from "@/lib/guides/inline";
import { readingMinutes } from "@/lib/guides/search";

// Every guide is known at build time; any other slug is a genuine 404.
export const dynamicParams = false;

export function generateStaticParams() {
  return GUIDES.map((g) => ({ slug: g.slug }));
}

interface GuidePageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: GuidePageProps): Promise<Metadata> {
  const guide = getGuide((await params).slug);
  if (!guide) return {};
  const path = `/guides/${guide.slug}`;
  return {
    title: guide.seoTitle,
    description: guide.description,
    alternates: { canonical: path },
    openGraph: {
      type: "article",
      siteName: SITE_NAME,
      title: guide.title,
      description: guide.description,
      url: path,
      images: [DEFAULT_OG_IMAGE],
      publishedTime: guide.published,
      modifiedTime: guide.updated,
      section: getCategory(guide.category).name,
    },
    twitter: { card: "summary_large_image", title: guide.title, description: guide.description, images: [DEFAULT_OG_IMAGE.url] },
  };
}

const formatDate = (iso: string) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });

export default async function GuidePage({ params }: GuidePageProps) {
  const guide = getGuide((await params).slug);
  if (!guide) notFound();

  const site = resolveSiteUrl().replace(/\/$/, "");
  const url = `${site}/guides/${guide.slug}`;
  const category = getCategory(guide.category);
  const toc = guide.blocks.filter((b): b is { type: "h2"; text: string } => b.type === "h2");
  const related = relatedGuides(guide);
  const minutes = readingMinutes(guide);
  const tutorials = guide.tutorials.map((s) => getTutorial(s)).filter((t): t is Tutorial => Boolean(t));

  // Article + BreadcrumbList structured data. The publisher is the site itself — no
  // invented individual author — and the dates are the guide's real published/updated dates.
  const org = { "@type": "Organization", name: SITE_NAME, url: site, logo: { "@type": "ImageObject", url: `${site}/logo.png` } };
  const jsonLd = JSON.stringify([
    {
      "@context": "https://schema.org",
      "@type": "Article",
      headline: guide.title,
      description: guide.description,
      image: [`${site}${DEFAULT_OG_IMAGE.url}`],
      datePublished: guide.published,
      dateModified: guide.updated,
      author: org,
      publisher: org,
      mainEntityOfPage: { "@type": "WebPage", "@id": url },
      articleSection: category.name,
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: site },
        { "@type": "ListItem", position: 2, name: "Guides", item: `${site}/guides` },
        { "@type": "ListItem", position: 3, name: guide.title, item: url },
      ],
    },
  ]).replace(/</g, "\\u003c");

  return (
    <main className="w-full min-w-0 flex-1 bg-slate-50">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd }} />

      <header
        className="text-slate-200"
        style={{
          backgroundImage:
            "radial-gradient(55% 70% at 8% 0%, rgba(139,92,246,0.22), transparent 70%), radial-gradient(40% 60% at 95% 0%, rgba(245,158,11,0.11), transparent 70%), linear-gradient(180deg, #080e24 0%, #0a1030 60%, #0c1236 100%)",
        }}
      >
        <div className="mx-auto max-w-6xl px-4 pb-10 pt-6 sm:px-6 sm:pb-14">
          <nav aria-label="Breadcrumb" className="text-sm text-slate-400">
            <ol className="flex flex-wrap items-center gap-1.5">
              <li>
                <Link href="/" className="hover:text-white">
                  Home
                </Link>
              </li>
              <li aria-hidden="true">
                <ChevronRight className="h-3.5 w-3.5" />
              </li>
              <li>
                <Link href="/guides" className="hover:text-white">
                  Guides
                </Link>
              </li>
              <li aria-hidden="true">
                <ChevronRight className="h-3.5 w-3.5" />
              </li>
              <li>
                <Link href={`/guides?category=${category.slug}#results`} className="hover:text-white">
                  {category.name}
                </Link>
              </li>
            </ol>
          </nav>
          <div className="mt-8 max-w-3xl">
            <p className="text-xs font-semibold uppercase tracking-wider text-amber-300">{category.name}</p>
            <h1 className="mt-3 text-3xl font-bold tracking-tight text-white sm:text-4xl">{guide.title}</h1>
            <p className="mt-4 text-lg leading-relaxed text-slate-300">{guide.intro}</p>
            <p className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-slate-400">
              <span>By {SITE_NAME} Guides</span>
              <span className="inline-flex items-center gap-1.5">
                <CalendarDays className="h-4 w-4" aria-hidden="true" />
                {guide.updated === guide.published ? "Published" : "Updated"}{" "}
                <time dateTime={guide.updated}>{formatDate(guide.updated)}</time>
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Clock className="h-4 w-4" aria-hidden="true" /> {minutes} min read
              </span>
            </p>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-6xl grid-cols-1 gap-10 px-4 py-10 sm:px-6 lg:grid-cols-[minmax(0,1fr)_260px] lg:py-14">
        <article className="min-w-0 max-w-3xl">
          {toc.length >= 3 && (
            <nav aria-labelledby="toc-title" className="mb-8 rounded-xl border border-slate-200 bg-white p-5 lg:hidden">
              <h2 id="toc-title" className="text-sm font-semibold uppercase tracking-wider text-slate-500">
                In this guide
              </h2>
              <ol className="mt-3 space-y-1.5 text-sm">
                {toc.map((h) => (
                  <li key={h.text}>
                    <a href={`#${headingId(h.text)}`} className="text-violet-700 hover:underline">
                      <GuideText text={h.text} />
                    </a>
                  </li>
                ))}
              </ol>
            </nav>
          )}

          <GuideBody blocks={guide.blocks} />

          {guide.riskDisclaimer && (
            <aside className="mt-10 flex gap-3 rounded-xl border border-slate-300 bg-slate-100 p-4 text-sm leading-6 text-slate-700">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-slate-500" aria-hidden="true" />
              <p>
                <strong className="text-slate-900">Risk disclaimer:</strong> This guide is general education, not
                financial advice. Trading forex and other leveraged products carries a high risk of loss, and automated
                trading tools can lose money. Backtested or past performance does not guarantee future results. Only trade
                with money you can afford to lose.
              </p>
            </aside>
          )}

          {guide.cta && (
            <section className="mt-10 rounded-2xl bg-gradient-to-br from-[#0c1236] to-[#1b1660] p-6 text-white sm:p-8">
              <p className="text-lg font-semibold">{guide.cta.text}</p>
              <Link
                href={guide.cta.href}
                className="mt-5 inline-flex items-center gap-2 rounded-lg bg-violet-500 px-5 py-3 text-sm font-semibold text-white transition hover:bg-violet-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-300"
              >
                {guide.cta.label} <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            </section>
          )}
        </article>

        {toc.length >= 3 && (
          <aside className="hidden lg:block">
            <nav aria-label="Table of contents" className="sticky top-24 rounded-xl border border-slate-200 bg-white p-5">
              <p className="text-sm font-semibold uppercase tracking-wider text-slate-500">In this guide</p>
              <ol className="mt-3 space-y-2 text-sm leading-5">
                {toc.map((h) => (
                  <li key={h.text}>
                    <a href={`#${headingId(h.text)}`} className="text-slate-600 hover:text-violet-700">
                      <GuideText text={h.text} />
                    </a>
                  </li>
                ))}
              </ol>
            </nav>
          </aside>
        )}
      </div>

      {tutorials.length > 0 && (
        <section aria-labelledby="practice-title" className="border-t border-slate-200 bg-slate-100/60">
          <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
            <div className="flex items-end justify-between gap-4">
              <h2 id="practice-title" className="text-2xl font-semibold tracking-tight text-slate-900">
                Put it into practice
              </h2>
              <Link href="/tutorials" className="text-sm font-medium text-violet-700 hover:underline">
                All tutorials
              </Link>
            </div>
            <p className="mt-2 text-slate-600">Step-by-step tutorials that build on this guide.</p>
            <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {tutorials.map((t) => (
                <li key={t.slug}>
                  <TutorialCard tutorial={t} />
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      {related.length > 0 && (
        <section aria-labelledby="related-title" className="border-t border-slate-200 bg-white">
          <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
            <div className="flex items-end justify-between gap-4">
              <h2 id="related-title" className="text-2xl font-semibold tracking-tight text-slate-900">
                Related guides
              </h2>
              <Link href="/guides" className="text-sm font-medium text-violet-700 hover:underline">
                All guides
              </Link>
            </div>
            <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {related.map((g) => (
                <li key={g.slug}>
                  <GuideCard guide={g} />
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}
    </main>
  );
}
