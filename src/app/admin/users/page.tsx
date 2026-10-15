import Link from "next/link";
import { searchUsers } from "@/features/admin/user-admin-service";
import { requireAdminPage } from "@/features/admin/viewer";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 20;

type Params = { q?: string; role?: string; status?: string; seller?: string; partnership?: string; page?: string };

function href(params: Params, page: number) {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries({ ...params, page: String(page) })) if (v) qs.set(k, v);
  return `/admin/users?${qs.toString()}`;
}

const select = "h-9 rounded-md border border-slate-300 bg-white px-2 text-sm";

export default async function AdminUsersPage({ searchParams }: { searchParams: Promise<Params> }) {
  await requireAdminPage("user:view_all");
  const params = await searchParams;
  const page = Math.max(1, Number.parseInt(params.page ?? "1", 10) || 1);
  const { items, total } = await searchUsers(params, page, PAGE_SIZE);
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div>
      <h1 className="text-2xl font-semibold text-slate-900">Users</h1>
      <p className="mt-1 text-sm text-slate-500">
        {total} user{total === 1 ? "" : "s"}
        {Object.values({ ...params, page: undefined }).some(Boolean) ? " match your filters" : ""}
      </p>

      <form method="get" className="mt-4 flex flex-wrap items-end gap-2" role="search" aria-label="Search users">
        <label className="grid gap-1 text-xs font-medium text-slate-600">
          Search
          <input name="q" defaultValue={params.q ?? ""} placeholder="Name, email or user ID" className="h-9 w-64 max-w-full rounded-md border border-slate-300 bg-white px-2 text-sm" />
        </label>
        <label className="grid gap-1 text-xs font-medium text-slate-600">
          Account type
          <select name="role" defaultValue={params.role ?? ""} className={select}>
            <option value="">All</option>
            {["USER", "SELLER", "AUTHOR", "MODERATOR", "ADMIN", "SUPER_ADMIN"].map((r) => (
              <option key={r} value={r}>
                {r.replace("_", " ")}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-xs font-medium text-slate-600">
          Status
          <select name="status" defaultValue={params.status ?? ""} className={select}>
            <option value="">All</option>
            <option value="active">Active</option>
            <option value="suspended">Suspended</option>
          </select>
        </label>
        <label className="grid gap-1 text-xs font-medium text-slate-600">
          Seller
          <select name="seller" defaultValue={params.seller ?? ""} className={select}>
            <option value="">All</option>
            <option value="yes">Sellers</option>
            <option value="no">Not sellers</option>
          </select>
        </label>
        <label className="grid gap-1 text-xs font-medium text-slate-600">
          Partnership
          <select name="partnership" defaultValue={params.partnership ?? ""} className={select}>
            <option value="">All</option>
            <option value="none">None</option>
            <option value="pending">Pending</option>
            <option value="approved">Partner</option>
            <option value="master">Master Partner</option>
            <option value="suspended">Suspended</option>
          </select>
        </label>
        <button type="submit" className="h-9 rounded-md bg-slate-900 px-3 text-sm font-medium text-white">
          Search
        </button>
        <Link href="/admin/users" className="h-9 content-center text-sm text-slate-500 hover:underline">
          Clear
        </Link>
      </form>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[760px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-slate-500">
              <th className="py-2 pr-4">Name</th>
              <th className="py-2 pr-4">Email</th>
              <th className="py-2 pr-4">Joined</th>
              <th className="py-2 pr-4">Type</th>
              <th className="py-2 pr-4">Status</th>
              <th className="py-2 pr-4">Partnership</th>
              <th className="py-2 pr-4" />
            </tr>
          </thead>
          <tbody>
            {items.map((user) => (
              <tr key={user.id} className="border-b border-slate-100">
                <td className="py-2 pr-4 font-medium text-slate-900">{user.name ?? "—"}</td>
                <td className="py-2 pr-4 text-slate-600">{user.email}</td>
                <td className="py-2 pr-4 text-slate-500">{user.createdAt.toLocaleDateString()}</td>
                <td className="py-2 pr-4">
                  <span className="text-slate-700">{user.role.replace("_", " ")}</span>
                  {user.adminRoleGrants.length > 0 && <span className="ml-1 text-xs text-slate-400">+{user.adminRoleGrants.length} admin role{user.adminRoleGrants.length === 1 ? "" : "s"}</span>}
                </td>
                <td className="py-2 pr-4">{user.bannedAt ? <Badge className="bg-red-100 text-red-700">Suspended</Badge> : <span className="text-slate-500">Active</span>}</td>
                <td className="py-2 pr-4 text-slate-600">
                  {user.partnerProfile ? (user.partnerProfile.masterStatus === "APPROVED" ? "Master Partner" : user.partnerProfile.status === "APPROVED" ? "Partner" : user.partnerProfile.status.toLowerCase()) : "—"}
                </td>
                <td className="py-2 pr-4 text-right">
                  <Link href={`/admin/users/${user.id}`} className="rounded-md border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50">
                    Open
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {items.length === 0 && <p className="py-8 text-center text-slate-500">No users match.</p>}
      </div>

      {pages > 1 && (
        <nav className="mt-4 flex items-center justify-between text-sm" aria-label="Pagination">
          {page > 1 ? (
            <Link href={href(params, page - 1)} className="text-blue-600 hover:underline">
              ← Previous
            </Link>
          ) : (
            <span />
          )}
          <span className="text-slate-500">
            Page {page} of {pages}
          </span>
          {page < pages ? (
            <Link href={href(params, page + 1)} className="text-blue-600 hover:underline">
              Next →
            </Link>
          ) : (
            <span />
          )}
        </nav>
      )}
    </div>
  );
}
