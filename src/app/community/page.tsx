import type { Metadata } from "next";
import { getViewerContext } from "@/features/community/viewer";
import { getSidebarData, listCategories, listPosts } from "@/features/community/queries";
import { parseFeedParams } from "@/lib/community/urls";
import { CommunityShell } from "@/components/community/community-shell";
import { FeedView } from "@/components/community/feed-view";
import type { CommunityPostType } from "@prisma/client";
import type { FeedSort } from "@/config/community";

export const metadata: Metadata = {
  title: "Community",
  description: "Forex trading ideas, questions, EA and indicator discussion, and market analysis from FX Bot Hub members.",
  alternates: { canonical: "/community" },
};

export const dynamic = "force-dynamic";

export default async function CommunityPage({ searchParams }: { searchParams: Promise<{ [key: string]: string | string[] | undefined }> }) {
  const params = parseFeedParams(await searchParams);
  const ctx = await getViewerContext();
  const [feed, categories, sidebar] = await Promise.all([
    listPosts({ sort: params.sort as FeedSort, type: params.type as CommunityPostType | undefined, categorySlugs: params.category, q: params.q, tag: params.tag, instrument: params.instrument, page: params.page }, ctx.viewer),
    listCategories(),
    getSidebarData(ctx.viewer),
  ]);

  return (
    <CommunityShell ctx={ctx} categories={categories} sidebar={sidebar} activeSlugs={params.category} activeSection={params.category || params.type ? undefined : "all"}>
      <FeedView base="/community" params={params} items={feed.items} total={feed.total} ctx={ctx} />
    </CommunityShell>
  );
}
