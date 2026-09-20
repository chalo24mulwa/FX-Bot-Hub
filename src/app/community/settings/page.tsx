import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getViewerContext } from "@/features/community/viewer";
import { ensureUsername } from "@/features/community/core";
import { getSidebarData, listCategories } from "@/features/community/queries";
import { CommunityShell } from "@/components/community/community-shell";
import { ProfileForm } from "@/components/community/profile-form";

export const metadata: Metadata = { title: "Community profile settings", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function CommunitySettingsPage() {
  const ctx = await getViewerContext();
  if (!ctx.viewer) redirect("/auth/sign-in?callbackUrl=/community/settings");
  // Opening settings is a deliberate act of joining in, so this is where the handle is first created.
  const username = await ensureUsername(ctx.viewer.id);
  const [profile, categories, sidebar] = await Promise.all([
    db.profile.findUnique({ where: { userId: ctx.viewer.id }, select: { bio: true } }),
    listCategories(),
    getSidebarData(ctx.viewer),
  ]);
  return (
    <CommunityShell ctx={ctx} categories={categories} sidebar={sidebar} title="Community profile" subtitle="How you appear to other members.">
      <ProfileForm username={username} bio={profile?.bio ?? ""} />
      <p className="text-sm text-slate-400">
        <Link href={`/community/u/${username}`} className="text-violet-300 hover:underline">View my public profile</Link> · Your email address and account details are never shown in the Community.
      </p>
    </CommunityShell>
  );
}
