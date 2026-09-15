import type { Metadata } from "next";
import Link from "next/link";
import { listPublishedArticles, listCategories } from "@/features/news/news-service";
import { Badge } from "@/components/ui/badge";

export const metadata: Metadata = { title: "Forex News" };
export const dynamic = "force-dynamic";

interface NewsPageProps {
  searchParams: Promise<{ category?: string; currency?: string; breaking?: string; page?: string }>;
}

export default async function NewsPage({ searchParams }: NewsPageProps) {
  const params = await searchParams;
  const [{ items, total }, categories] = await Promise.all([
    listPublishedArticles({
      categorySlug: params.category,
      currency: params.currency,
      breaking: params.breaking === "true" ? true : undefined,
      page: Number(params.page ?? 1),
    }),
    listCategories(),
  ]);

  return (
    <main className="mx-auto max-w-5xl flex-1 px-6 py-12">
      <h1 className="text-2xl font-semibold text-slate-900">Forex News</h1>
      <p className="mt-1 text-sm text-slate-500">{total} article{total === 1 ? "" : "s"}</p>

      <div className="mt-4 flex flex-wrap gap-2">
        <Link
          href="/news"
          className={`rounded-full px-3 py-1 text-xs font-medium ${!params.category && !params.breaking ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
        >
          All
        </Link>
        <Link
          href="/news?breaking=true"
          className={`rounded-full px-3 py-1 text-xs font-medium ${params.breaking === "true" ? "bg-red-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
        >
          Breaking
        </Link>
        {categories.map((c) => (
          <Link
            key={c.id}
            href={`/news?category=${c.slug}`}
            className={`rounded-full px-3 py-1 text-xs font-medium ${params.category === c.slug ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
          >
            {c.name}
          </Link>
        ))}
      </div>

      {items.length === 0 ? (
        <p className="mt-8 text-slate-500">No articles yet.</p>
      ) : (
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
          {items.map((article) => (
            <Link
              key={article.id}
              href={`/news/${article.slug}`}
              className="flex flex-col gap-2 rounded-lg border border-slate-200 p-4 hover:shadow-md"
            >
              <div className="flex flex-wrap items-center gap-1.5">
                {article.breaking && <Badge className="border-red-300 bg-red-50 text-red-800">Breaking</Badge>}
                {article.category && <Badge>{article.category.name}</Badge>}
                {article.currency && <Badge>{article.currency}</Badge>}
              </div>
              <h2 className="font-semibold text-slate-900">{article.title}</h2>
              <p className="line-clamp-2 text-sm text-slate-600">{article.summary}</p>
              <p className="text-xs text-slate-400">
                {article.sourceName} · {article.publishedAt?.toLocaleDateString()}
              </p>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
