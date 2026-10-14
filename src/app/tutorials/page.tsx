import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, BookOpen, ChevronRight, GraduationCap, ListOrdered, Search, X } from "lucide-react";
import { TUTORIALS, FEATURED_TUTORIAL_SLUG, getTutorial, getTutorialCategory, tutorialCategoriesWithCounts } from "@/content/tutorials";
import { DIFFICULTIES, type TutorialCategorySlug } from "@/content/tutorials/types";
import { DifficultyBadge, EstimatedTime, TutorialCard } from "@/components/tutorials/tutorial-meta";
import { pageMetadata } from "@/lib/seo/site";
import { resolveSiteUrl } from "@/lib/site-url";
import {
  MAX_TUTORIAL_QUERY_LENGTH,
  paginateTutorials,
  parseTutorialQuery,
  searchTutorials,
  tutorialsHref,
  type TutorialQuery,
} from "@/lib/tutorials/search";
import { cn } from "@/lib/utils";

const PATH = "/tutorials";
const DESCRIPTION =
  "Learn step by step with practical MT4 and MT5 tutorials covering forex bots, Expert Advisors, indicators, backtesting, troubleshooting and FXBotHub tools.";

interface TutorialsPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export async function generateMetadata({ searchParams }: TutorialsPageProps): Promise<Metadata> {
  const { q } = parseTutorialQuery(await searchParams);
  return {
    // Filtered, sorted and paged views canonicalise to the hub itself; search results are noindex.
    ...pageMetadata({ title: "Forex Tutorials: MT4, MT5 & Trading Bots", description: DESCRIPTION, path: PATH, noindex: Boolean(q) }),
    title: { absolute: "Forex Tutorials: MT4, MT5 & Trading Bots | FXBotHub" },
  };
}

function jsonLd() {
  const site = resolveSiteUrl().replace(/\/$/, "");
  return JSON.stringify([
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: site },
        { "@type": "ListItem", position: 2, name: "Tutorials", item: `${site}${PATH}` },
      ],
    },
    {
      "@context": "https://schema.org",
      "@type": "ItemList",
      name: "Forex trading tutorials",
      itemListElement: TUTORIALS.map((t, i) => ({ "@type": "ListItem", position: i + 1, url: `${site}${PATH}/${t.slug}`, name: t.title })),
    },
  ]).replace(/</g, "\\u003c");
}

const chip = (active: boolean, dark = true) =>
  cn(
    "inline-flex items-center rounded-full border px-3 py-1.5 text-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400",
    dark
      ? active
        ? "border-amber-300/60 bg-amber-300/15 text-amber-100"
        : "border-white/15 text-slate-300 hover:border-white/30 hover:text-white"
      : active
        ? "border-violet-600 bg-violet-600 text-white"
        : "border-slate-300 bg-white text-slate-700 hover:border-slate-400",
  );

/** A simple, generic diagram of the featured tutorial's path — an illustration, not a screenshot. */
function FeaturedVisual() {
  const nodes = ["Download", "Install", "Log in", "Data folder"];
  return (
    <svg viewBox="0 0 360 200" role="img" aria-label="Illustration: download, install, log in, open the data folder" className="h-auto w-full">
      <defs>
        <linearGradient id="tv-bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#1b1660" />
          <stop offset="1" stopColor="#0c1236" />
        </linearGradient>
        <linearGradient id="tv-line" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#8b5cf6" />
          <stop offset="1" stopColor="#f59e0b" />
        </linearGradient>
      </defs>
      <rect width="360" height="200" rx="18" fill="url(#tv-bg)" />
      <rect x="22" y="20" width="316" height="22" rx="6" fill="#ffffff" fillOpacity="0.06" />
      <circle cx="36" cy="31" r="4" fill="#f87171" fillOpacity="0.7" />
      <circle cx="50" cy="31" r="4" fill="#fbbf24" fillOpacity="0.7" />
      <circle cx="64" cy="31" r="4" fill="#34d399" fillOpacity="0.7" />
      <path d="M52 112 H308" stroke="url(#tv-line)" strokeWidth="3" strokeLinecap="round" strokeDasharray="2 8" />
      {nodes.map((label, i) => {
        const x = 52 + i * 85.3;
        return (
          <g key={label}>
            <circle cx={x} cy="112" r="20" fill={i === nodes.length - 1 ? "#f59e0b" : "#8b5cf6"} />
            <text x={x} y="118" textAnchor="middle" fontSize="16" fontWeight="700" fill="#fff">
              {i + 1}
            </text>
            <text x={x} y="158" textAnchor="middle" fontSize="12" fill="#cbd5e1">
              {label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

export default async function TutorialsPage({ searchParams }: TutorialsPageProps) {
  const query = parseTutorialQuery(await searchParams);
  const { q, category, difficulty, sort } = query;
  const filtering = Boolean(q || category || difficulty);
  const results = searchTutorials(TUTORIALS, query);
  const paged = paginateTutorials(results, query.page);
  const categories = tutorialCategoriesWithCounts();
  const featured = getTutorial(FEATURED_TUTORIAL_SLUG)!;
  const activeCategory = category ? getTutorialCategory(category as TutorialCategorySlug) : null;
  const href = (overrides: Partial<TutorialQuery>, hash = "#results") => tutorialsHref({ q, category, difficulty, sort, ...overrides, page: overrides.page ?? 1 }, hash);

  return (
    <main className="w-full min-w-0 flex-1 bg-slate-50">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd() }} />

      {/* Hero */}
      <section
        className="text-slate-200"
        style={{
          backgroundImage:
            "radial-gradient(55% 60% at 10% 0%, rgba(139,92,246,0.22), transparent 70%), radial-gradient(40% 50% at 95% 0%, rgba(245,158,11,0.12), transparent 70%), linear-gradient(180deg, #080e24 0%, #0a1030 60%, #0c1236 100%)",
        }}
      >
        <div className="mx-auto max-w-6xl px-4 pb-12 pt-6 sm:px-6 sm:pb-16">
          <nav aria-label="Breadcrumb" className="text-sm text-slate-400">
            <ol className="flex items-center gap-1.5">
              <li>
                <Link href="/" className="hover:text-white">
                  Home
                </Link>
              </li>
              <li aria-hidden="true">
                <ChevronRight className="h-3.5 w-3.5" />
              </li>
              <li aria-current="page" className="text-slate-200">
                Tutorials
              </li>
            </ol>
          </nav>

          <div className="mt-10 grid grid-cols-1 items-center gap-10 lg:grid-cols-[minmax(0,1fr)_380px]">
            <div className="min-w-0">
              <h1 className="text-4xl font-bold tracking-tight text-white sm:text-5xl">Forex Trading Tutorials: Learn Step by Step</h1>
              <p className="mt-5 max-w-2xl text-lg leading-relaxed text-slate-300">
                Practical, numbered walkthroughs for MetaTrader 4 and MetaTrader 5 — install the platform, add Expert
                Advisors and indicators, configure and backtest them, fix the common problems, and get your tools from
                FXBotHub.
              </p>

              <form action={`${PATH}#results`} method="get" role="search" className="mt-8 flex max-w-2xl gap-2">
                {category && <input type="hidden" name="category" value={category} />}
                {difficulty && <input type="hidden" name="difficulty" value={difficulty} />}
                {sort === "newest" && <input type="hidden" name="sort" value="newest" />}
                <label htmlFor="tutorial-search" className="sr-only">
                  Search tutorials
                </label>
                <div className="relative min-w-0 flex-1">
                  <Search className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" aria-hidden="true" />
                  <input
                    id="tutorial-search"
                    type="search"
                    name="q"
                    defaultValue={q}
                    maxLength={MAX_TUTORIAL_QUERY_LENGTH}
                    placeholder="Search tutorials…"
                    className="h-12 w-full rounded-lg border border-white/15 bg-white pl-11 pr-3 text-base text-slate-900 shadow-lg shadow-black/20 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-400"
                  />
                </div>
                <button
                  type="submit"
                  className="h-12 shrink-0 rounded-lg bg-violet-500 px-5 text-sm font-semibold text-white transition hover:bg-violet-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-300 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a1030]"
                >
                  Search
                </button>
              </form>

              <div className="mt-6 flex flex-wrap items-center gap-3">
                <Link
                  href={`/tutorials/${featured.slug}`}
                  className="inline-flex items-center gap-2 rounded-lg bg-amber-400 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-amber-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-200"
                >
                  <GraduationCap className="h-4 w-4" aria-hidden="true" /> Start Learning
                </Link>
                <Link href={tutorialsHref({ difficulty: "beginner" }, "#results")} className="text-sm font-medium text-slate-300 underline-offset-4 hover:text-white hover:underline">
                  Show beginner tutorials
                </Link>
              </div>
            </div>

            {/* Featured tutorial */}
            <article className="group relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04] p-4 shadow-2xl shadow-black/30">
              <FeaturedVisual />
              <div className="px-1 pb-1 pt-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-amber-300">Featured tutorial</p>
                <h2 className="mt-1.5 text-lg font-semibold leading-snug text-white">
                  <Link href={`/tutorials/${featured.slug}`} className="after:absolute after:inset-0 after:rounded-2xl focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-amber-300">
                    {featured.title}
                  </Link>
                </h2>
                <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-slate-300">
                  <DifficultyBadge difficulty={featured.difficulty} />
                  <EstimatedTime minutes={featured.estimatedMinutes} />
                  <span className="inline-flex items-center gap-1.5">
                    <ListOrdered className="h-4 w-4" aria-hidden="true" /> {featured.steps.length} steps
                  </span>
                </div>
              </div>
            </article>
          </div>

          <nav aria-label="Tutorial categories" className="mt-10">
            <ul className="flex flex-wrap gap-2">
              <li>
                <Link href={href({ category: "" })} aria-current={!category ? "page" : undefined} className={chip(!category)}>
                  All tutorials
                </Link>
              </li>
              {categories.map((c) => (
                <li key={c.slug}>
                  <Link href={href({ category: c.slug })} aria-current={category === c.slug ? "page" : undefined} className={chip(category === c.slug)}>
                    {c.name}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>
      </section>

      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
        {!filtering && (
          <section aria-labelledby="categories-title" className="mb-14">
            <h2 id="categories-title" className="text-2xl font-semibold tracking-tight text-slate-900">
              Browse by topic
            </h2>
            <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {categories.map((c) => (
                <li key={c.slug}>
                  <Link
                    href={tutorialsHref({ category: c.slug }, "#results")}
                    className="flex h-full flex-col rounded-xl border border-slate-200 bg-white p-5 transition hover:border-violet-300 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
                  >
                    <span className="flex items-center justify-between gap-3">
                      <span className="font-semibold text-slate-900">{c.name}</span>
                      <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                        {c.count} {c.count === 1 ? "tutorial" : "tutorials"}
                      </span>
                    </span>
                    <span className="mt-2 text-sm leading-6 text-slate-600">{c.description}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section id="results" aria-labelledby="results-title" className="scroll-mt-24">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 id="results-title" className="text-2xl font-semibold tracking-tight text-slate-900">
                {q ? <>Results for &ldquo;{q}&rdquo;</> : activeCategory ? activeCategory.name : filtering ? "Filtered tutorials" : "All tutorials"}
              </h2>
              <p className="mt-1 text-sm text-slate-500" aria-live="polite">
                {results.length} {results.length === 1 ? "tutorial" : "tutorials"}
                {q && activeCategory ? ` in ${activeCategory.name}` : ""}
                {difficulty ? ` · ${DIFFICULTIES.find((d) => d.slug === difficulty)!.name}` : ""}
              </p>
            </div>
            {filtering && (
              <Link href={tutorialsHref({}, "#results")} className="inline-flex items-center gap-1 text-sm font-medium text-violet-700 hover:underline">
                <X className="h-4 w-4" aria-hidden="true" /> Clear search and filters
              </Link>
            )}
          </div>

          <div className="mt-5 flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 flex-wrap items-center gap-2" role="group" aria-label="Filter by difficulty">
              <span className="mr-1 text-sm font-medium text-slate-600">Level:</span>
              <Link href={href({ difficulty: "" })} aria-current={!difficulty ? "true" : undefined} className={chip(!difficulty, false)}>
                All levels
              </Link>
              {DIFFICULTIES.map((d) => (
                <Link key={d.slug} href={href({ difficulty: d.slug })} aria-current={difficulty === d.slug ? "true" : undefined} className={chip(difficulty === d.slug, false)}>
                  {d.name}
                </Link>
              ))}
            </div>
            <div className="flex shrink-0 items-center gap-2" role="group" aria-label="Sort tutorials">
              <span className="text-sm font-medium text-slate-600">Sort:</span>
              <Link href={href({ sort: "relevance" })} aria-current={sort === "relevance" ? "true" : undefined} className={chip(sort === "relevance", false)}>
                {q ? "Relevance" : "Learning path"}
              </Link>
              <Link href={href({ sort: "newest" })} aria-current={sort === "newest" ? "true" : undefined} className={chip(sort === "newest", false)}>
                Newest
              </Link>
            </div>
          </div>

          {paged.items.length === 0 ? (
            <div className="mt-6 rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center">
              <p className="font-medium text-slate-900">No tutorials match your search.</p>
              <p className="mt-2 text-sm text-slate-600">
                Try fewer or different words, choose another level, or{" "}
                <Link href={tutorialsHref({}, "#results")} className="font-medium text-violet-700 hover:underline">
                  see all tutorials
                </Link>
                . For background and concepts, search the{" "}
                <Link href={q ? `/guides?q=${encodeURIComponent(q)}` : "/guides"} className="font-medium text-violet-700 hover:underline">
                  Guides
                </Link>
                , or ask in the{" "}
                <Link href="/community" className="font-medium text-violet-700 hover:underline">
                  Community
                </Link>
                .
              </p>
            </div>
          ) : (
            <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {paged.items.map((t) => (
                <li key={t.slug}>
                  <TutorialCard tutorial={t} />
                </li>
              ))}
            </ul>
          )}

          {paged.totalPages > 1 && (
            <nav aria-label="Tutorial pages" className="mt-8 flex items-center justify-center gap-3 text-sm">
              {paged.page > 1 && (
                <Link href={href({ page: paged.page - 1 })} rel="prev" className="rounded-lg border border-slate-300 bg-white px-4 py-2 hover:bg-slate-50">
                  Previous
                </Link>
              )}
              <span className="text-slate-500">
                Page {paged.page} of {paged.totalPages}
              </span>
              {paged.page < paged.totalPages && (
                <Link href={href({ page: paged.page + 1 })} rel="next" className="rounded-lg border border-slate-300 bg-white px-4 py-2 hover:bg-slate-50">
                  Next
                </Link>
              )}
            </nav>
          )}
        </section>

        <section className="mt-16 grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8">
            <h2 className="flex items-center gap-2 text-xl font-semibold text-slate-900">
              <BookOpen className="h-5 w-5 text-violet-600" aria-hidden="true" /> Tutorials or guides?
            </h2>
            <p className="mt-2 text-slate-600">
              Tutorials are hands-on: numbered steps you follow in MetaTrader or on FXBotHub. For the background — what an
              Expert Advisor is, how risk and drawdown work, what to look for in a bot — read the{" "}
              <Link href="/guides" className="font-medium text-violet-700 hover:underline">
                Guides
              </Link>
              .
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8">
            <h2 className="text-xl font-semibold text-slate-900">Ready to find a tool?</h2>
            <p className="mt-2 text-slate-600">Browse Expert Advisors and indicators for your platform, free and paid.</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Link href="/marketplace?platform=MT5&type=EA" className="inline-flex items-center gap-1 rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-500">
                MT5 EAs <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
              <Link href="/marketplace?platform=MT4&type=EA" className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50">
                MT4 EAs
              </Link>
              <Link href="/marketplace?type=INDICATOR" className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50">
                Indicators
              </Link>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
