import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  ExternalLink,
  Info,
  ListChecks,
  Store,
  Target,
  Wrench,
} from "lucide-react";
import { TUTORIALS, adjacentTutorials, getTutorial, getTutorialCategory, relatedTutorials } from "@/content/tutorials";
import { getGuide } from "@/content/guides";
import type { Guide } from "@/content/guides/types";
import { GuideBody, GuideText } from "@/components/guides/guide-content";
import { DifficultyBadge, EstimatedTime, TutorialCard } from "@/components/tutorials/tutorial-meta";
import { ReadingProgressBar, StepDoneToggle, TutorialProgressSummary } from "@/components/tutorials/tutorial-progress";
import { DEFAULT_OG_IMAGE, SITE_NAME } from "@/lib/seo/site";
import { resolveSiteUrl } from "@/lib/site-url";
import { cn } from "@/lib/utils";

// Every tutorial is known at build time; any other slug is a genuine 404.
export const dynamicParams = false;

export function generateStaticParams() {
  return TUTORIALS.map((t) => ({ slug: t.slug }));
}

interface TutorialPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: TutorialPageProps): Promise<Metadata> {
  const tutorial = getTutorial((await params).slug);
  if (!tutorial) return {};
  const path = `/tutorials/${tutorial.slug}`;
  return {
    title: tutorial.seoTitle,
    description: tutorial.description,
    alternates: { canonical: path },
    openGraph: {
      type: "article",
      siteName: SITE_NAME,
      title: tutorial.title,
      description: tutorial.description,
      url: path,
      images: [DEFAULT_OG_IMAGE],
      publishedTime: tutorial.published,
      modifiedTime: tutorial.updated,
      section: getTutorialCategory(tutorial.category).name,
    },
    twitter: { card: "summary_large_image", title: tutorial.title, description: tutorial.description, images: [DEFAULT_OG_IMAGE.url] },
  };
}

const formatDate = (iso: string) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });

const stepId = (i: number) => `step-${i + 1}`;

function SectionHeading({ id, icon: Icon, children }: { id: string; icon: typeof Info; children: React.ReactNode }) {
  return (
    <h2 id={id} className="flex scroll-mt-24 items-center gap-2.5 text-2xl font-semibold tracking-tight text-slate-900">
      <Icon className="h-6 w-6 shrink-0 text-violet-600" aria-hidden="true" />
      {children}
    </h2>
  );
}

export default async function TutorialPage({ params }: TutorialPageProps) {
  const tutorial = getTutorial((await params).slug);
  if (!tutorial) notFound();

  const site = resolveSiteUrl().replace(/\/$/, "");
  const url = `${site}/tutorials/${tutorial.slug}`;
  const category = getTutorialCategory(tutorial.category);
  const { previous, next: following } = adjacentTutorials(tutorial.slug);
  const recommendedNext = tutorial.next ? getTutorial(tutorial.next) : following;
  const related = relatedTutorials(tutorial).filter((t) => t.slug !== recommendedNext?.slug);
  const guides = tutorial.guides.map((s) => getGuide(s)).filter((g): g is Guide => Boolean(g));

  const sections = [
    { id: "before-you-start", label: "Before you start" },
    { id: "what-youll-learn", label: "What you'll learn" },
    { id: "steps", label: "Steps" },
    ...(tutorial.reference ? [{ id: "reference", label: tutorial.reference.heading }] : []),
    { id: "expected-result", label: "Expected result" },
    { id: "troubleshooting", label: "Troubleshooting" },
  ];

  // TechArticle + BreadcrumbList. The publisher and author are the site itself (no
  // invented individuals), the dates are real, and there is no rating or video markup
  // because neither exists on the page.
  const org = { "@type": "Organization", name: SITE_NAME, url: site, logo: { "@type": "ImageObject", url: `${site}/logo.png` } };
  const jsonLd = JSON.stringify([
    {
      "@context": "https://schema.org",
      "@type": "TechArticle",
      headline: tutorial.title,
      description: tutorial.description,
      image: [`${site}${DEFAULT_OG_IMAGE.url}`],
      datePublished: tutorial.published,
      dateModified: tutorial.updated,
      author: org,
      publisher: org,
      mainEntityOfPage: { "@type": "WebPage", "@id": url },
      articleSection: category.name,
      // schema.org only defines "Beginner" and "Expert"; intermediate tutorials omit it.
      ...(tutorial.difficulty === "beginner" ? { proficiencyLevel: "Beginner" } : tutorial.difficulty === "advanced" ? { proficiencyLevel: "Expert" } : {}),
      timeRequired: `PT${tutorial.estimatedMinutes}M`,
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: site },
        { "@type": "ListItem", position: 2, name: "Tutorials", item: `${site}/tutorials` },
        { "@type": "ListItem", position: 3, name: category.name, item: `${site}/tutorials?category=${category.slug}` },
        { "@type": "ListItem", position: 4, name: tutorial.title, item: url },
      ],
    },
  ]).replace(/</g, "\\u003c");

  const tocLinks = (
    <ol className="space-y-1.5 text-sm leading-5">
      {sections.map((s) => (
        <li key={s.id}>
          <a href={`#${s.id}`} className="text-slate-600 hover:text-violet-700">
            {s.label}
          </a>
          {s.id === "steps" && (
            <ol className="mt-1.5 space-y-1 border-l border-slate-200 pl-3">
              {tutorial.steps.map((step, i) => (
                <li key={step.title}>
                  <a href={`#${stepId(i)}`} className="text-slate-500 hover:text-violet-700">
                    {i + 1}. <GuideText text={step.title} />
                  </a>
                </li>
              ))}
            </ol>
          )}
        </li>
      ))}
    </ol>
  );

  return (
    <main className="w-full min-w-0 flex-1 bg-slate-50">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd }} />
      <ReadingProgressBar />

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
                <Link href="/tutorials" className="hover:text-white">
                  Tutorials
                </Link>
              </li>
              <li aria-hidden="true">
                <ChevronRight className="h-3.5 w-3.5" />
              </li>
              <li>
                <Link href={`/tutorials?category=${category.slug}#results`} className="hover:text-white">
                  {category.name}
                </Link>
              </li>
            </ol>
          </nav>
          <div className="mt-8 max-w-3xl">
            <p className="text-xs font-semibold uppercase tracking-wider text-amber-300">{category.name} tutorial</p>
            <h1 className="mt-3 text-3xl font-bold tracking-tight text-white sm:text-4xl">{tutorial.title}</h1>
            <p className="mt-4 text-lg leading-relaxed text-slate-300">
              <GuideText text={tutorial.intro} />
            </p>
            <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-3 text-sm text-slate-300">
              <DifficultyBadge difficulty={tutorial.difficulty} />
              <EstimatedTime minutes={tutorial.estimatedMinutes} />
              <span className="inline-flex items-center gap-1.5">
                <ListChecks className="h-4 w-4" aria-hidden="true" /> {tutorial.steps.length} steps
              </span>
              <span className="inline-flex items-center gap-1.5 text-slate-400">
                <CalendarDays className="h-4 w-4" aria-hidden="true" />
                {tutorial.updated === tutorial.published ? "Published" : "Updated"}{" "}
                <time dateTime={tutorial.updated}>{formatDate(tutorial.updated)}</time>
              </span>
            </div>
            <p className="mt-3 text-xs text-slate-400">Times are estimates — they vary with your computer, connection and experience.</p>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-6xl grid-cols-1 gap-10 px-4 py-10 sm:px-6 lg:grid-cols-[minmax(0,1fr)_280px] lg:py-14">
        <article className="min-w-0 max-w-3xl space-y-12">
          {/* Mobile: progress + contents inline (the desktop versions sit in the sidebar). */}
          <div className="space-y-4 lg:hidden">
            <TutorialProgressSummary slug={tutorial.slug} total={tutorial.steps.length} className="rounded-xl border border-slate-200 bg-white p-4" />
            <details className="rounded-xl border border-slate-200 bg-white p-4">
              <summary className="cursor-pointer text-sm font-semibold uppercase tracking-wider text-slate-500">In this tutorial</summary>
              <nav aria-label="Table of contents" className="mt-3">
                {tocLinks}
              </nav>
            </details>
          </div>

          <section aria-labelledby="before-you-start">
            <SectionHeading id="before-you-start" icon={ListChecks}>
              Before you start
            </SectionHeading>
            <ul className="mt-4 space-y-2 text-[17px] leading-7 text-slate-700">
              {tutorial.requirements.map((r) => (
                <li key={r} className="flex gap-3">
                  <span className="mt-2.5 h-1.5 w-1.5 shrink-0 rounded-full bg-violet-500" aria-hidden="true" />
                  <span>
                    <GuideText text={r} />
                  </span>
                </li>
              ))}
            </ul>
          </section>

          <section aria-labelledby="what-youll-learn">
            <SectionHeading id="what-youll-learn" icon={Target}>
              What you&apos;ll learn
            </SectionHeading>
            <ul className="mt-4 space-y-2 text-[17px] leading-7 text-slate-700">
              {tutorial.outcomes.map((o) => (
                <li key={o} className="flex gap-3">
                  <CheckCircle2 className="mt-1 h-5 w-5 shrink-0 text-emerald-600" aria-hidden="true" />
                  <span>
                    <GuideText text={o} />
                  </span>
                </li>
              ))}
            </ul>
          </section>

          <section aria-labelledby="steps">
            <SectionHeading id="steps" icon={ListChecks}>
              Steps
            </SectionHeading>
            <ol className="mt-6 space-y-5">
              {tutorial.steps.map((step, i) => (
                <li key={step.title} id={stepId(i)} className="scroll-mt-24 rounded-xl border border-slate-200 bg-white p-5 sm:p-6">
                  <div className="flex gap-4">
                    <span
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-violet-600 text-sm font-bold text-white"
                      aria-hidden="true"
                    >
                      {i + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <h3 className="text-lg font-semibold leading-snug text-slate-900">
                        <span className="sr-only">Step {i + 1}: </span>
                        <GuideText text={step.title} />
                      </h3>
                      <div className="mt-2 space-y-3 text-[17px] leading-7 text-slate-700">
                        {step.text.map((p) => (
                          <p key={p}>
                            <GuideText text={p} />
                          </p>
                        ))}
                        {step.items && (
                          <ul className="list-disc space-y-1.5 pl-5 marker:text-violet-400">
                            {step.items.map((item) => (
                              <li key={item}>
                                <GuideText text={item} />
                              </li>
                            ))}
                          </ul>
                        )}
                        {step.note && (
                          <p
                            className={cn(
                              "flex gap-2.5 rounded-lg border p-3 text-[15px] leading-6",
                              step.note.tone === "warning" ? "border-amber-200 bg-amber-50 text-amber-900" : "border-sky-200 bg-sky-50 text-sky-900",
                            )}
                          >
                            {step.note.tone === "warning" ? (
                              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                            ) : (
                              <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                            )}
                            <span>
                              <GuideText text={step.note.text} />
                            </span>
                          </p>
                        )}
                      </div>
                      <div className="mt-4">
                        <StepDoneToggle slug={tutorial.slug} index={i} title={step.title} />
                      </div>
                    </div>
                  </div>
                </li>
              ))}
            </ol>
          </section>

          {tutorial.reference && (
            <section aria-labelledby="reference">
              <SectionHeading id="reference" icon={BookOpen}>
                {tutorial.reference.heading}
              </SectionHeading>
              <div className="mt-4">
                <GuideBody blocks={tutorial.reference.blocks} />
              </div>
            </section>
          )}

          <section aria-labelledby="expected-result" className="rounded-xl border border-emerald-200 bg-emerald-50 p-5 sm:p-6">
            <h2 id="expected-result" className="flex scroll-mt-24 items-center gap-2.5 text-xl font-semibold text-emerald-950">
              <CheckCircle2 className="h-6 w-6 shrink-0 text-emerald-600" aria-hidden="true" /> Expected result
            </h2>
            <p className="mt-3 text-[17px] leading-7 text-emerald-950">
              <GuideText text={tutorial.expectedResult} />
            </p>
          </section>

          <section aria-labelledby="troubleshooting">
            <SectionHeading id="troubleshooting" icon={Wrench}>
              Troubleshooting
            </SectionHeading>
            <dl className="mt-4 divide-y divide-slate-200 rounded-xl border border-slate-200 bg-white">
              {tutorial.troubleshooting.map((t) => (
                <div key={t.problem} className="p-4 sm:p-5">
                  <dt className="font-semibold text-slate-900">
                    <GuideText text={t.problem} />
                  </dt>
                  <dd className="mt-1.5 leading-7 text-slate-700">
                    <GuideText text={t.fix} />
                  </dd>
                </div>
              ))}
            </dl>
          </section>

          {tutorial.sources && tutorial.sources.length > 0 && (
            <section aria-labelledby="sources-title">
              <h2 id="sources-title" className="text-sm font-semibold uppercase tracking-wider text-slate-500">
                Official documentation
              </h2>
              <ul className="mt-3 space-y-1.5 text-sm">
                {tutorial.sources.map((s) => (
                  <li key={s.url}>
                    <a href={s.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-medium text-violet-700 hover:underline">
                      {s.label} <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                      <span className="sr-only">(opens in a new tab)</span>
                    </a>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {tutorial.riskDisclaimer && (
            <aside className="flex gap-3 rounded-xl border border-slate-300 bg-slate-100 p-4 text-sm leading-6 text-slate-700">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-slate-500" aria-hidden="true" />
              <p>
                <strong className="text-slate-900">Risk disclaimer:</strong> This tutorial is general education, not financial
                advice. Trading forex and other leveraged products carries a high risk of loss, and automated trading tools
                can lose money. Backtested or past performance does not guarantee future results. Test on a demo account first
                and only trade with money you can afford to lose.
              </p>
            </aside>
          )}

          {recommendedNext && (
            <section aria-labelledby="next-title" className="rounded-2xl bg-gradient-to-br from-[#0c1236] to-[#1b1660] p-6 text-white sm:p-8">
              <p id="next-title" className="text-xs font-semibold uppercase tracking-wider text-amber-300">
                Next tutorial
              </p>
              <p className="mt-2 text-xl font-semibold">{recommendedNext.title}</p>
              <p className="mt-2 text-slate-300">{recommendedNext.description}</p>
              <Link
                href={`/tutorials/${recommendedNext.slug}`}
                className="mt-5 inline-flex items-center gap-2 rounded-lg bg-violet-500 px-5 py-3 text-sm font-semibold text-white transition hover:bg-violet-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-300"
              >
                Continue <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            </section>
          )}

          <nav aria-label="Previous and next tutorials" className="grid gap-3 sm:grid-cols-2">
            {previous ? (
              <Link
                href={`/tutorials/${previous.slug}`}
                rel="prev"
                className="group rounded-xl border border-slate-200 bg-white p-4 transition hover:border-violet-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
              >
                <span className="inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wider text-slate-500">
                  <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" /> Previous
                </span>
                <span className="mt-1 block font-medium text-slate-900 group-hover:text-violet-700">{previous.title}</span>
              </Link>
            ) : (
              <span className="hidden sm:block" />
            )}
            {following && (
              <Link
                href={`/tutorials/${following.slug}`}
                rel="next"
                className="group rounded-xl border border-slate-200 bg-white p-4 text-right transition hover:border-violet-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
              >
                <span className="inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Next <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                </span>
                <span className="mt-1 block font-medium text-slate-900 group-hover:text-violet-700">{following.title}</span>
              </Link>
            )}
          </nav>
        </article>

        <aside className="hidden lg:block">
          <div className="sticky top-24 space-y-4">
            <TutorialProgressSummary slug={tutorial.slug} total={tutorial.steps.length} className="rounded-xl border border-slate-200 bg-white p-5" />
            <nav aria-label="Table of contents" className="max-h-[calc(100vh-18rem)] overflow-y-auto rounded-xl border border-slate-200 bg-white p-5">
              <p className="mb-3 text-sm font-semibold uppercase tracking-wider text-slate-500">In this tutorial</p>
              {tocLinks}
            </nav>
          </div>
        </aside>
      </div>

      <section aria-labelledby="more-title" className="border-t border-slate-200 bg-white">
        <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
          <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_320px]">
            <div className="min-w-0">
              <div className="flex items-end justify-between gap-4">
                <h2 id="more-title" className="text-2xl font-semibold tracking-tight text-slate-900">
                  Related tutorials
                </h2>
                <Link href="/tutorials" className="text-sm font-medium text-violet-700 hover:underline">
                  All tutorials
                </Link>
              </div>
              <ul className="mt-6 grid gap-4 sm:grid-cols-2">
                {related.slice(0, 2).map((t) => (
                  <li key={t.slug}>
                    <TutorialCard tutorial={t} />
                  </li>
                ))}
              </ul>
            </div>
            <div className="space-y-8">
              {guides.length > 0 && (
                <div>
                  <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-slate-500">
                    <BookOpen className="h-4 w-4" aria-hidden="true" /> Background reading
                  </h2>
                  <ul className="mt-3 space-y-2">
                    {guides.map((g) => (
                      <li key={g.slug}>
                        <Link href={`/guides/${g.slug}`} className="font-medium text-violet-700 hover:underline">
                          {g.title}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {tutorial.links.length > 0 && (
                <div>
                  <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-slate-500">
                    <Store className="h-4 w-4" aria-hidden="true" /> On the marketplace
                  </h2>
                  <ul className="mt-3 space-y-2">
                    {tutorial.links.map((l) => (
                      <li key={l.href}>
                        <Link href={l.href} className="inline-flex items-center gap-1 font-medium text-violet-700 hover:underline">
                          {l.label} <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
