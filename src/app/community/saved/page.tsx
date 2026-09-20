import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getViewerContext } from "@/features/community/viewer";
import { getSidebarData, listCategories, listPosts } from "@/features/community/queries";
import { parseFeedParams } from "@/lib/community/urls";
import { CommunityShell } from "@/components/community/community-shell";
import { FeedView } from "@/components/community/feed-view";
import type { FeedSort } from "@/config/community";

export const metadata: Metadata = { title: "Saved posts — Community", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function SavedPostsPage({ searchParams }: { searchParams: Promise<{ [key: string]: string | string[] | undefined }> }) {
  const ctx = await getViewerContext();
  if (!ctx.viewer) redirect("/auth/sign-in?callbackUrl=/community/saved");
  const params = parseFeedParams(await searchParams);
  const [feed, categories, sidebar] = await Promise.all([
    listPosts({ sort: params.sort as FeedSort, bookmarkedBy: ctx.viewer.id, page: params.page }, ctx.viewer),
    listCategories(),
    getSidebarData(ctx.viewer),
  ]);
  return (
    <CommunityShell ctx={ctx} categories={categories} sidebar={sidebar} activeSection="saved" title="Saved posts" subtitle="Posts you've bookmarked. Only you can see this list.">
      <FeedView base="/community/saved" params={params} items={feed.items} total={feed.total} ctx={ctx} lockedCategory showSections={false} emptyMessage="You haven't saved anything yet. Use Save on any post to keep it here." />
    </CommunityShell>
  );
}
