import Link from "next/link";
import { adminGetUserRestrictions, adminSearchUsers } from "@/features/community/queries";
import { LiftRestrictionButton, RestrictionForm } from "@/components/admin/community-admin";
import { Badge } from "@/components/ui/badge";
import { isRestrictionActive, resolveStanding } from "@/lib/community/restrictions";

export const dynamic = "force-dynamic";

const STATE_STYLE: Record<string, string> = {
  ACTIVE: "border-emerald-200 bg-emerald-50 text-emerald-700",
  POSTING_SUSPENDED: "border-amber-200 bg-amber-50 text-amber-700",
  COMMUNITY_SUSPENDED: "border-orange-200 bg-orange-50 text-orange-700",
  BANNED: "border-red-200 bg-red-50 text-red-700",
};

const fmt = (d: Date | null) => (d ? d.toLocaleString() : "—");

export default async function AdminCommunityMembers({ searchParams }: { searchParams: Promise<{ q?: string; history?: string }> }) {
  const params = await searchParams;
  const q = params.q?.trim().slice(0, 80) ?? "";
  const users = await adminSearchUsers(q);
  const history = params.history ? await adminGetUserRestrictions(params.history) : null;
  const now = new Date();

  return (
    <div className="space-y-6">
      <form className="flex flex-wrap items-center gap-2" role="search">
        <input name="q" defaultValue={q} placeholder="Search by name, email or @username (2+ characters)…" aria-label="Search members" className="h-9 w-96 max-w-full rounded-md border border-slate-300 px-3 text-sm" />
        <button className="h-9 rounded-md bg-slate-900 px-4 text-sm font-medium text-white">Search</button>
      </form>

      {q.length < 2 ? (
        <p className="text-sm text-slate-500">Search for a member to view or change their Community standing.</p>
      ) : users.length === 0 ? (
        <p className="text-sm text-slate-500">No members match “{q}”.</p>
      ) : (
        <div className="divide-y divide-slate-100 rounded-lg border border-slate-200">
          {users.map((u) => {
            const standing = resolveStanding(u.communityRestrictions, now);
            const display = u.name ?? u.profile?.username ?? u.email;
            return (
              <article key={u.id} className="space-y-3 p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium text-slate-900">{display}</span>
                  {u.profile?.username && (
                    <Link href={`/community/u/${u.profile.username}`} className="text-sm text-blue-600 hover:underline">
                      @{u.profile.username}
                    </Link>
                  )}
                  <Badge>{u.role}</Badge>
                  <Badge className={STATE_STYLE[standing.state]}>{standing.state.replace("_", " ")}</Badge>
                  <span className="text-xs text-slate-400">
                    {u.email} · joined {u.createdAt.toLocaleDateString()} · {u._count.communityPosts} posts · {u._count.communityComments} comments
                  </span>
                </div>

                {u.communityRestrictions.filter((r) => isRestrictionActive(r, now)).map((r) => (
                  <div key={r.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-slate-50 px-3 py-2 text-sm">
                    <span>
                      <strong>{r.state.replace("_", " ")}</strong> — {r.reason} <span className="text-slate-400">(until {r.endsAt ? fmt(r.endsAt) : "further notice"})</span>
                    </span>
                    <LiftRestrictionButton restrictionId={r.id} isBan={r.state === "BANNED"} />
                  </div>
                ))}

                <div className="flex flex-wrap items-start gap-3">
                  <details className="min-w-0 flex-1">
                    <summary className="cursor-pointer text-sm font-medium text-slate-700 hover:text-slate-900">Restrict this member…</summary>
                    <div className="mt-3">
                      <RestrictionForm userId={u.id} displayName={display} />
                    </div>
                  </details>
                  <Link href={`/admin/community/members?q=${encodeURIComponent(q)}&history=${u.id}`} className="text-sm text-blue-600 hover:underline">
                    Restriction history
                  </Link>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {history && (
        <section>
          <h2 className="mb-2 text-lg font-semibold text-slate-900">Restriction history</h2>
          {history.length === 0 ? (
            <p className="text-sm text-slate-500">No restrictions have ever been issued to this member.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] border-collapse text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-slate-500">
                    <th className="py-2 pr-3">State</th>
                    <th className="py-2 pr-3">Reason</th>
                    <th className="py-2 pr-3">Starts</th>
                    <th className="py-2 pr-3">Ends</th>
                    <th className="py-2 pr-3">Issued by</th>
                    <th className="py-2 pr-3">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((r) => (
                    <tr key={r.id} className="border-b border-slate-100 align-top">
                      <td className="py-2 pr-3">{r.state.replace("_", " ")}</td>
                      <td className="py-2 pr-3 text-slate-600">{r.reason}</td>
                      <td className="py-2 pr-3 text-slate-500">{fmt(r.startsAt)}</td>
                      <td className="py-2 pr-3 text-slate-500">{r.endsAt ? fmt(r.endsAt) : "Permanent"}</td>
                      <td className="py-2 pr-3 text-slate-500">{r.issuedBy.name ?? r.issuedBy.email}</td>
                      <td className="py-2 pr-3 text-slate-500">{r.liftedAt ? `Lifted ${fmt(r.liftedAt)}` : isRestrictionActive(r, now) ? "Active" : "Expired"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
