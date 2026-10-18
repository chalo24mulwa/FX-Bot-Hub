import { auth } from "@/lib/auth";
import { cacheWrap } from "@/lib/cache";
import type { Metadata } from "next";
import { getViewerContext } from "@/features/community/viewer";
import { getSidebarData, listCategories, listPosts } from "@/features/community/queries";
import { parseFeedParams } from "@/lib/community/urls";
import { CommunityShell } from "@/components/community/community-shell";
import { FeedView } from "@/components/community/feed-view";
import type { CommunityPostType } from "@prisma/client";
import type { FeedSort } from "@/config/community";
import { pageMetadata } from "@/lib/seo/site";

export const metadata: Metadata = pageMetadata({
  title: "Forex Trading Community and Forums",
  description: "Forex trading ideas, questions, EA and indicator discussion, and market analysis from FX Bot Hub members.",
  path: "/community",
});

export const dynamic = "force-dynamic";

export default async function CommunityPage({ searchParams }: { searchParams: Promise<{ [key: string]: string | string[] | undefined }> }) {
  const params = parseFeedParams(await searchParams);
  // The viewer's id and role come straight from the session (no database), so the feed, the categories, the sidebar and the viewer's
  // standing can all be fetched side by side instead of the feed waiting for the standing lookup first (each trip is ~100 ms).
  const session = await auth();
  const viewer = session?.user ? { id: session.user.id, role: session.user.role } : null;
  const load = () =>
    Promise.all([
      listPosts({ sort: params.sort as FeedSort, type: params.type as CommunityPostType | undefined, categorySlugs: params.category, q: params.q, tag: params.tag, instrument: params.instrument, page: params.page }, viewer),
      listCategories(),
      getSidebarData(viewer),
    ]);
  // Signed-out visitors all see the same feed: cached 30 s. A signed-in member's feed carries their own like/save state, so it is never shared.
  const [ctx, [feed, categories, sidebar]] = await Promise.all([getViewerContext(), viewer ? load() : cacheWrap(`community:feed:${JSON.stringify(params)}`, 30, load)]);

  return (
    <CommunityShell ctx={ctx} categories={categories} sidebar={sidebar} activeSlugs={params.category} activeSection={params.category || params.type ? undefined : "all"}>
      <FeedView base="/community" params={params} items={feed.items} total={feed.total} ctx={ctx} />
    </CommunityShell>
  );
}
