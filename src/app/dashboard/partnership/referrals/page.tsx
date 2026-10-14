import type { Metadata } from "next";
import { requireApprovedPartnerPage } from "@/features/partnership/guard";
import { PAGE_SIZE, listReferredUsers } from "@/features/partnership/queries";
import { EmptyState, Pager, fmtDate, firstParam, parsePage } from "@/components/partnership/ui";
import { formatMoney } from "@/lib/partnership/rules";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Referred users", robots: { index: false, follow: false } };

export default async function ReferredUsersPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const profile = await requireApprovedPartnerPage();
  const sp = await searchParams;
  const q = firstParam(sp.q).slice(0, 60);
  const page = parsePage(sp.page);
  const { items, total } = await listReferredUsers(profile.id, { q, page });
  const href = (p: number) => `/dashboard/partnership/referrals?${new URLSearchParams({ ...(q ? { q } : {}), ...(p > 1 ? { page: String(p) } : {}) })}`;

  return (
    <div className="min-w-0">
      <h1 className="text-2xl font-semibold text-slate-900">Referred users</h1>
      <p className="mt-1 text-sm text-slate-600">
        Accounts registered through your links. For their privacy you see a display name (or an anonymous label) — never email addresses or payment details.
      </p>
      <form method="get" className="mt-4 flex max-w-md gap-2" role="search">
        <label htmlFor="ref-q" className="sr-only">
          Search by display name
        </label>
        <input id="ref-q" name="q" defaultValue={q} placeholder="Search by display name" className="h-9 min-w-0 flex-1 rounded-md border border-slate-300 px-3 text-sm" />
        <button className="h-9 rounded-md bg-slate-900 px-3 text-sm font-medium text-white">Search</button>
      </form>
      <p className="mt-3 text-sm text-slate-500">{total} referred {total === 1 ? "user" : "users"}</p>
      {items.length === 0 ? (
        <div className="mt-4">
          <EmptyState title={q ? "Nobody matches that name." : "No referred users yet."}>
            {!q && "When someone signs up after following your link, they'll appear here."}
          </EmptyState>
        </div>
      ) : (
        <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="w-full min-w-[560px] text-sm">
            <thead className="bg-slate-50 text-left text-slate-500">
              <tr>
                <th className="px-4 py-2 font-medium">Member</th>
                <th className="px-4 py-2 font-medium">Registered</th>
                <th className="px-4 py-2 font-medium">Status</th>
                <th className="px-4 py-2 font-medium">Eligible purchases</th>
                <th className="px-4 py-2 font-medium">Your commission</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.map((u) => (
                <tr key={u.key}>
                  <td className="px-4 py-2 font-medium text-slate-900">{u.label}</td>
                  <td className="whitespace-nowrap px-4 py-2 text-slate-600">{fmtDate(u.registeredAt)}</td>
                  <td className="px-4 py-2 text-slate-600">{u.purchased ? "Purchased" : "Registered"}</td>
                  <td className="px-4 py-2 text-slate-700">{u.sales.map((s) => formatMoney(s.basisCents, s.currency)).join(", ") || "—"}</td>
                  <td className="px-4 py-2 text-slate-700">{u.sales.map((s) => formatMoney(s.amountCents, s.currency)).join(", ") || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Pager page={page} total={total} pageSize={PAGE_SIZE} href={href} />
    </div>
  );
}
