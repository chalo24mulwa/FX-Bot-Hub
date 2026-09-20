import type { Metadata } from "next";
import Link from "next/link";
import { Hash, Layers, Search, Users } from "lucide-react";
import { getViewerContext } from "@/features/community/viewer";
import { getSidebarData, listCategories, searchCommunity } from "@/features/community/queries";
import { normalizeInstrument } from "@/lib/community/trade";
import { CommunityDisclaimer, CommunityShell } from "@/components/community/community-shell";
import { PostCard } from "@/components/community/post-card";
import { UserAvatar } from "@/components/community/user-avatar";

export const metadata: Metadata = { title: "Search — Community", robots: { index: false } };
export const dynamic = "force-dynamic";

function Section({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-white/10 bg-[#0e1530]/85 p-4">
      <h2 className="mb-3 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
        {icon}
        {title}
      </h2>
      {children}
    </section>
  );
}

export default async function CommunitySearchPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const q = ((await searchParams).q ?? "").trim().slice(0, 80);
  const ctx = await getViewerContext();
  const [categories, sidebar, results] = await Promise.all([listCategories(), getSidebarData(ctx.viewer), searchCommunity(q, ctx.viewer)]);
  const empty = results.posts.length + results.users.length + results.categories.length + results.tags.length === 0;
  // "eurusd" / "EUR/USD" style queries also offer the pair page.
  const pair = /^[A-Za-z]{3}[/ -]?[A-Za-z]{3}$|^xau|^xag/i.test(q) ? normalizeInstrument(q) : null;

  return (
    <CommunityShell ctx={ctx} categories={categories} sidebar={sidebar} title="Search" subtitle={q ? `Results for “${q}”` : "Search posts, people, pairs and tags."} query={q}>
      {q.length < 2 ? (
        <div className="rounded-2xl border border-dashed border-white/15 px-6 py-14 text-center text-sm text-slate-400">
          <Search className="mx-auto mb-3 h-7 w-7 text-slate-500" aria-hidden="true" />
          Type at least two characters to search posts, members, trading pairs, categories and tags.
        </div>
      ) : (
        <>
          {pair && (
            <Link href={`/community?instrument=${encodeURIComponent(pair)}`} className="flex items-center justify-between rounded-2xl border border-violet-400/40 bg-violet-500/10 px-4 py-3 text-sm text-violet-100 hover:bg-violet-500/20">
              <span>
                See all discussions about <strong className="font-mono">{pair}</strong>
              </span>
              <span aria-hidden="true">→</span>
            </Link>
          )}

          {results.categories.length > 0 && (
            <Section title="Communities" icon={<Layers className="h-3.5 w-3.5 text-violet-300" aria-hidden="true" />}>
              <ul className="flex flex-wrap gap-2">
                {results.categories.map((c) => (
                  <li key={c.id}>
                    <Link href={`/community/c/${c.slug}`} className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-slate-100 hover:border-violet-400/60 hover:bg-white/10">
                      {c.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </Section>
          )}

          {results.users.length > 0 && (
            <Section title="People" icon={<Users className="h-3.5 w-3.5 text-emerald-300" aria-hidden="true" />}>
              <ul className="grid gap-1 sm:grid-cols-2">
                {results.users.map((u) => (
                  <li key={u.id}>
                    <Link href={`/community/u/${u.username}`} className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 hover:bg-white/5">
                      <UserAvatar user={u} size="sm" className="ring-white/20" />
                      <span className="truncate text-sm text-slate-100">{u.displayName}</span>
                      <span className="truncate text-xs text-slate-500">@{u.username}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </Section>
          )}

          {results.tags.length > 0 && (
            <Section title="Topics & tags" icon={<Hash className="h-3.5 w-3.5 text-sky-300" aria-hidden="true" />}>
              <div className="flex flex-wrap gap-2">
                {results.tags.map((t) => (
                  <Link key={t.tag} href={`/community?tag=${encodeURIComponent(t.tag)}`} className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-sm text-slate-100 hover:border-violet-400/60">
                    #{t.tag} <span className="text-slate-500">{t.count}</span>
                  </Link>
                ))}
              </div>
            </Section>
          )}

          {results.posts.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">Posts</h2>
                <Link href={`/community?q=${encodeURIComponent(q)}`} className="text-sm font-medium text-violet-300 hover:underline">
                  Sort &amp; filter all results →
                </Link>
              </div>
              {results.posts.map((p) => (
                <PostCard key={p.id} post={p} ctx={ctx} />
              ))}
            </div>
          )}

          {empty && !pair && (
            <div className="rounded-2xl border border-dashed border-white/15 px-6 py-14 text-center text-sm text-slate-400">
              Nothing matched “{q}”. Try a pair like EUR/USD, a tag, or a member&apos;s username.
            </div>
          )}
        </>
      )}
      <CommunityDisclaimer />
    </CommunityShell>
  );
}
