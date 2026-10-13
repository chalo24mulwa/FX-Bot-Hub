import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, BookOpen, ChevronRight, Clock, Search, X } from "lucide-react";
import { GUIDES, FEATURED_GUIDE_SLUG, categoriesWithGuides, getCategory, getGuide } from "@/content/guides";
import { GuideCard } from "@/components/guides/guide-card";
import { pageMetadata } from "@/lib/seo/site";
import { resolveSiteUrl } from "@/lib/site-url";
import { paginate, parseGuideQuery, readingMinutes, searchGuides, MAX_QUERY_LENGTH } from "@/lib/guides/search";
import { cn } from "@/lib/utils";

const PATH = "/guides";
const DESCRIPTION =
  "Learn forex trading basics, MT4 and MT5 tutorials, Expert Advisor installation, forex indicators, backtesting, risk management and how to use FXBotHub.";

interface GuidesPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export async function generateMetadata({ searchParams }: GuidesPageProps): Promise<Metadata> {
  const { q } = parseGuideQuery(await searchParams);
  return {
    // Filtered and paged views canonicalise to the hub itself; search results are noindex.
    ...pageMetadata({ title: "Forex Trading Guides & MT4/MT5 Tutorials", description: DESCRIPTION, path: PATH, noindex: Boolean(q) }),
    title: { absolute: "Forex Trading Guides & MT4/MT5 Tutorials | FXBotHub" },
  };
}

function breadcrumbJsonLd() {
  const site = resolveSiteUrl().replace(/\/$/, "");
  return JSON.stringify({
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: site },
      { "@type": "ListItem", position: 2, name: "Guides", item: `${site}${PATH}` },
    ],
  }).replace(/</g, "\\u003c");
}

function hrefWith(params: { q?: string; category?: string; page?: number }) {
  const sp = new URLSearchParams();
  if (params.q) sp.set("q", params.q);
  if (params.category) sp.set("category", params.category);
  if (params.page && params.page > 1) sp.set("page", String(params.page));
  const qs = sp.toString();
  return qs ? `${PATH}?${qs}` : PATH;
}

export default async function GuidesPage({ searchParams }: GuidesPageProps) {
  const { q, category, page } = parseGuideQuery(await searchParams);
  const filtering = Boolean(q || category);
  const results = searchGuides(GUIDES, q, category);
  const paged = paginate(results, page);
  const categories = categoriesWithGuides();
  const featured = getGuide(FEATURED_GUIDE_SLUG);
  const activeCategory = category ? getCategory(category as Parameters<typeof getCategory>[0]) : null;

  return (
    <main className="w-full min-w-0 flex-1 bg-slate-50">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: breadcrumbJsonLd() }} />

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
                Guides
              </li>
            </ol>
          </nav>

          <div className="mt-10 max-w-3xl">
            <h1 className="text-4xl font-bold tracking-tight text-white sm:text-5xl">Forex Trading Guides &amp; Resources</h1>
            <p className="mt-5 text-lg leading-relaxed text-slate-300">
              Learn how to use MetaTrader 4 and MetaTrader 5, understand forex trading tools, explore automated trading
              systems, and get more from the FXBotHub marketplace with practical, step-by-step guides.
            </p>
          </div>

          <form action={PATH} method="get" role="search" className="mt-8 flex max-w-2xl gap-2">
            {category && <input type="hidden" name="category" value={category} />}
            <label htmlFor="guide-search" className="sr-only">
              Search guides
            </label>
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" aria-hidden="true" />
              <input
                id="guide-search"
                type="search"
                name="q"
                defaultValue={q}
                maxLength={MAX_QUERY_LENGTH}
                placeholder="Search guides, tutorials and resources…"
                className="h-12 w-full rounded-lg border border-white/15 bg-white pl-11 pr-3 text-base text-slate-900 shadow-lg shadow-black/20 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-400"
              />
            </div>
            <button
              type="submit"
              className="h-12 rounded-lg bg-violet-500 px-5 text-sm font-semibold text-white transition hover:bg-violet-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-300 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a1030]"
            >
              Search
            </button>
          </form>

          <nav aria-label="Guide categories" className="mt-6">
            <ul className="flex flex-wrap gap-2">
              <li>
                <Link
                  href={hrefWith({ q })}
                  aria-current={!category ? "page" : undefined}
                  className={cn(
                    "inline-flex rounded-full border px-3 py-1.5 text-sm transition",
                    !category ? "border-amber-300/60 bg-amber-300/15 text-amber-100" : "border-white/15 text-slate-300 hover:border-white/30 hover:text-white",
                  )}
                >
                  All guides
                </Link>
              </li>
              {categories.map((c) => (
                <li key={c.slug}>
                  <Link
                    href={hrefWith({ q, category: c.slug })}
                    aria-current={category === c.slug ? "page" : undefined}
                    className={cn(
                      "inline-flex rounded-full border px-3 py-1.5 text-sm transition",
                      category === c.slug
                        ? "border-amber-300/60 bg-amber-300/15 text-amber-100"
                        : "border-white/15 text-slate-300 hover:border-white/30 hover:text-white",
                    )}
                  >
                    {c.name}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>
      </section>

      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
        {!filtering && featured && (
          <section aria-labelledby="featured-title" className="mb-14">
            <h2 id="featured-title" className="text-sm font-semibold uppercase tracking-wider text-slate-500">
              New to forex? Start here
            </h2>
            <article className="group relative mt-4 overflow-hidden rounded-2xl border border-violet-200 bg-gradient-to-br from-white via-white to-violet-50 p-6 shadow-sm transition hover:shadow-md sm:p-8">
              <div className="flex items-start gap-4">
                <span className="hidden h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-violet-600 text-white sm:flex">
                  <BookOpen className="h-6 w-6" aria-hidden="true" />
                </span>
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-wider text-violet-700">Featured beginner guide</p>
                  <h3 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">
                    <Link href={`/guides/${featured.slug}`} className="after:absolute after:inset-0 focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-violet-500">
                      {featured.title}
                    </Link>
                  </h3>
                  <p className="mt-3 max-w-3xl text-slate-600">{featured.intro}</p>
                  <p className="mt-4 inline-flex items-center gap-4 text-sm text-slate-500">
                    <span className="inline-flex items-center gap-1.5">
                      <Clock className="h-4 w-4" aria-hidden="true" /> {readingMinutes(featured)} min read
                    </span>
                    <span className="inline-flex items-center gap-1 font-medium text-violet-700" aria-hidden="true">
                      Read the guide <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
                    </span>
                  </p>
                </div>
              </div>
            </article>
          </section>
        )}

        {!filtering && (
          <section aria-labelledby="categories-title" className="mb-14">
            <h2 id="categories-title" className="text-2xl font-semibold tracking-tight text-slate-900">
              Browse by topic
            </h2>
            <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {categories.map((c) => (
                <li key={c.slug}>
                  <Link
                    href={hrefWith({ category: c.slug }) + "#results"}
                    className="flex h-full flex-col rounded-xl border border-slate-200 bg-white p-5 transition hover:border-violet-300 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
                  >
                    <span className="flex items-center justify-between gap-3">
                      <span className="font-semibold text-slate-900">{c.name}</span>
                      <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                        {c.count} {c.count === 1 ? "guide" : "guides"}
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
                {q ? <>Results for &ldquo;{q}&rdquo;</> : activeCategory ? activeCategory.name : "All guides"}
              </h2>
              <p className="mt-1 text-sm text-slate-500" aria-live="polite">
                {results.length} {results.length === 1 ? "guide" : "guides"}
                {q && activeCategory ? ` in ${activeCategory.name}` : ""}
              </p>
            </div>
            {filtering && (
              <Link href={PATH} className="inline-flex items-center gap-1 text-sm font-medium text-violet-700 hover:underline">
                <X className="h-4 w-4" aria-hidden="true" /> Clear search and filters
              </Link>
            )}
          </div>

          {paged.items.length === 0 ? (
            <div className="mt-6 rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center">
              <p className="font-medium text-slate-900">No guides match your search.</p>
              <p className="mt-2 text-sm text-slate-600">
                Try fewer or different words, or browse a topic above. Looking for something we haven&apos;t covered? Ask
                in the{" "}
                <Link href="/community" className="font-medium text-violet-700 hover:underline">
                  Community
                </Link>
                .
              </p>
            </div>
          ) : (
            <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {paged.items.map((g) => (
                <li key={g.slug}>
                  <GuideCard guide={g} />
                </li>
              ))}
            </ul>
          )}

          {paged.totalPages > 1 && (
            <nav aria-label="Guide pages" className="mt-8 flex items-center justify-center gap-3 text-sm">
              {paged.page > 1 && (
                <Link href={hrefWith({ q, category, page: paged.page - 1 })} className="rounded-lg border border-slate-300 bg-white px-4 py-2 hover:bg-slate-50">
                  Previous
                </Link>
              )}
              <span className="text-slate-500">
                Page {paged.page} of {paged.totalPages}
              </span>
              {paged.page < paged.totalPages && (
                <Link href={hrefWith({ q, category, page: paged.page + 1 })} className="rounded-lg border border-slate-300 bg-white px-4 py-2 hover:bg-slate-50">
                  Next
                </Link>
              )}
            </nav>
          )}
        </section>

        <section className="mt-16 rounded-2xl border border-slate-200 bg-white p-6 sm:p-8">
          <h2 className="text-xl font-semibold text-slate-900">Building or selling trading tools?</h2>
          <p className="mt-2 max-w-2xl text-slate-600">
            See the{" "}
            <Link href="/developer-resources" className="font-medium text-violet-700 hover:underline">
              Developer Resources
            </Link>{" "}
            for MQL4 and MQL5 references, submission guidelines and the license API, or read{" "}
            <Link href="/guides/selling-trading-tools-on-fxbothub" className="font-medium text-violet-700 hover:underline">
              the seller&apos;s guide
            </Link>
            .
          </p>
        </section>
      </div>
    </main>
  );
}
