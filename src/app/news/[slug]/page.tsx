import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Image from "next/image";
import { getArticleBySlug } from "@/features/news/news-service";
import { Badge } from "@/components/ui/badge";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { AlertSubscribeButton } from "@/components/alerts/alert-subscribe-button";

export const dynamic = "force-dynamic";

interface ArticlePageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: ArticlePageProps): Promise<Metadata> {
  const { slug } = await params;
  const article = await getArticleBySlug(slug);
  if (!article) return {};
  return {
    title: article.title,
    description: article.summary,
    alternates: { canonical: `/news/${article.slug}` },
    openGraph: { title: article.title, description: article.summary, images: article.imageUrl ? [article.imageUrl] : undefined },
  };
}

export default async function ArticlePage({ params }: ArticlePageProps) {
  const { slug } = await params;
  const [article, session] = await Promise.all([getArticleBySlug(slug), auth()]);
  if (!article) notFound();

  const subscribed =
    session?.user && article.categoryId
      ? Boolean(
          await db.alert.findUnique({
            where: { userId_type_targetId: { userId: session.user.id, type: "NEWS_TOPIC", targetId: article.categoryId } },
          })
        )
      : false;

  return (
    <main className="mx-auto max-w-2xl flex-1 px-6 py-12">
      <div className="flex flex-wrap items-center gap-1.5">
        {article.breaking && <Badge className="border-red-300 bg-red-50 text-red-800">Breaking</Badge>}
        {article.category && <Badge>{article.category.name}</Badge>}
        {article.currency && <Badge>{article.currency}</Badge>}
      </div>
      <h1 className="mt-2 text-2xl font-semibold text-slate-900">{article.title}</h1>
      <p className="mt-1 text-sm text-slate-500">
        {article.sourceName} · {article.publishedAt?.toLocaleString()}
      </p>

      {article.imageUrl && (
        <div className="relative mt-6 aspect-[16/9] w-full overflow-hidden rounded-lg bg-slate-100">
          <Image src={article.imageUrl} alt={article.title} fill className="object-cover" />
        </div>
      )}

      <p className="mt-6 whitespace-pre-wrap text-slate-700">{article.summary}</p>

      <a href={article.sourceUrl} target="_blank" rel="noopener noreferrer" className="mt-4 inline-block text-sm text-blue-600 hover:underline">
        Read the full article at {article.sourceName} →
      </a>

      {session?.user && article.categoryId && article.category && (
        <div className="mt-6">
          <AlertSubscribeButton
            type="NEWS_TOPIC"
            targetId={article.categoryId}
            initialSubscribed={subscribed}
            label={`Alert me on ${article.category.name} news`}
          />
        </div>
      )}

      <p className="mt-10 text-xs text-slate-400">
        Summary and attribution only — this is not a reproduction of the source article.
      </p>
    </main>
  );
}
