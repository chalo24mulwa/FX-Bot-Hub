import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { imageUploadsConfigured } from "@/features/community/config";
import { getViewerContext } from "@/features/community/viewer";
import { getSidebarData, listCategories } from "@/features/community/queries";
import { CommunityDisclaimer, CommunityShell, RestrictionBanner } from "@/components/community/community-shell";
import { PostComposer } from "@/components/community/post-composer";
import { db } from "@/lib/db";

export const metadata: Metadata = { title: "Create post — Community", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function NewPostPage({ searchParams }: { searchParams: Promise<{ category?: string }> }) {
  const ctx = await getViewerContext();
  if (!ctx.viewer) redirect("/auth/sign-in?callbackUrl=/community/new");

  const { category } = await searchParams;
  const [categories, sidebar] = await Promise.all([listCategories(), getSidebarData(ctx.viewer)]);
  const preset = category ? await db.communityCategory.findUnique({ where: { slug: category }, select: { id: true } }) : null;

  return (
    <CommunityShell ctx={ctx} categories={categories} sidebar={sidebar} title="Create a post" subtitle="Share an idea, ask a question or start a discussion.">
      {ctx.caps.canPost ? (
        <PostComposer categories={categories.map((c) => ({ id: c.id, name: c.name }))} defaultCategoryId={preset?.id} imagesEnabled={imageUploadsConfigured()} />
      ) : (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-sm text-slate-300">
          {/* The shell already shows the restriction notice above the page; only fall back when there is none. */}
          {!ctx.restrictionNotice && <RestrictionBanner message="You can't post in the Community right now." />}
          <p className="font-medium text-white">New posts aren&apos;t available on your account right now.</p>
          <p className="mt-1 text-slate-400">You can keep reading, and the rest of your FX Bot Hub account works as usual.</p>
          <Link href="/community" className="mt-4 inline-block font-medium text-amber-400 hover:underline">
            Back to the Community feed
          </Link>
        </div>
      )}
      <CommunityDisclaimer />
    </CommunityShell>
  );
}
