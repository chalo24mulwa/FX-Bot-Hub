import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { getViewerContext } from "@/features/community/viewer";
import { getSidebarData, listCategories, listPosts } from "@/features/community/queries";
import { parseFeedParams } from "@/lib/community/urls";
import { CommunityShell } from "@/components/community/community-shell";
import { FeedView } from "@/components/community/feed-view";
import type { CommunityPostType } from "@prisma/client";
import type { FeedSort } from "@/config/community";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<{ [key: string]: string | string[] | undefined }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const category = await db.communityCategory.findUnique({ where: { slug }, select: { name: true, description: true, isActive: true } });
  if (!category?.isActive) return {};
  return { title: `${category.name} — Community`, description: category.description ?? undefined, alternates: { canonical: `/community/c/${slug}` } };
}

export default async function CommunityCategoryPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const category = await db.communityCategory.findUnique({ where: { slug } });
  if (!category || !category.isActive) notFound();

  // The category comes from the path; the rest of the filters from the query string.
  const feedParams = { ...parseFeedParams(await searchParams), category: [slug] };
  const ctx = await getViewerContext();
  const [feed, categories, sidebar] = await Promise.all([
    listPosts({ sort: feedParams.sort as FeedSort, type: feedParams.type as CommunityPostType | undefined, categorySlugs: [slug], q: feedParams.q, tag: feedParams.tag, instrument: feedParams.instrument, page: feedParams.page }, ctx.viewer),
    listCategories(),
    getSidebarData(ctx.viewer),
  ]);

  return (
    <CommunityShell ctx={ctx} categories={categories} sidebar={sidebar} activeSlugs={[slug]} title={category.name} subtitle={category.description ?? "Discussions in this community."}>
      <FeedView base={`/community/c/${slug}`} params={feedParams} items={feed.items} total={feed.total} ctx={ctx} lockedCategory showSections={false} emptyMessage="Nobody has posted in this community yet — start the first discussion." />
    </CommunityShell>
  );
}
