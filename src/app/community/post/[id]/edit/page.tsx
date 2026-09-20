import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getViewerContext } from "@/features/community/viewer";
import { getPostDetail, getSidebarData, listCategories } from "@/features/community/queries";
import { db } from "@/lib/db";
import { CommunityShell, RestrictionBanner } from "@/components/community/community-shell";
import { PostComposer } from "@/components/community/post-composer";

export const metadata: Metadata = { title: "Edit post — Community", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function EditPostPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await getViewerContext();
  if (!ctx.viewer) redirect(`/auth/sign-in?callbackUrl=/community/post/${id}/edit`);

  const post = await getPostDetail(id, ctx.viewer);
  // Only the author edits; anyone else gets the same 404 as a missing post.
  if (!post || !post.isAuthor || post.status !== "PUBLISHED") notFound();

  const [categories, sidebar, category] = await Promise.all([listCategories(), getSidebarData(ctx.viewer), db.communityCategory.findUnique({ where: { slug: post.category.slug }, select: { id: true } })]);

  return (
    <CommunityShell ctx={ctx} categories={categories} sidebar={sidebar} title="Edit post" subtitle="Changes are marked “edited”. Images can't be changed after posting.">
      {ctx.caps.canPost ? (
        <PostComposer
          mode="edit"
          postId={post.id}
          categories={categories.map((c) => ({ id: c.id, name: c.name }))}
          imagesEnabled={false}
          initial={{
            type: post.type,
            categoryId: category?.id ?? "",
            title: post.title,
            content: post.content,
            instrument: post.instrument ?? "",
            direction: post.direction ?? "",
            timeframe: post.timeframe ?? "",
            entryPrice: post.entryPrice ?? "",
            stopLoss: post.stopLoss ?? "",
            takeProfit: post.takeProfit ?? "",
            tags: post.tags.join(", "),
          }}
        />
      ) : (
        !ctx.restrictionNotice && <RestrictionBanner message="You can't edit posts right now." />
      )}
    </CommunityShell>
  );
}
