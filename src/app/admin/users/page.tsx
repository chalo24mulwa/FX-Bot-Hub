import { listUsers } from "@/features/admin/user-management-service";
import { UserRowActions } from "@/components/admin/user-row-actions";

export const dynamic = "force-dynamic";

interface AdminUsersPageProps {
  searchParams: Promise<{ page?: string }>;
}

export default async function AdminUsersPage({ searchParams }: AdminUsersPageProps) {
  const params = await searchParams;
  const page = Number(params.page ?? 1);
  const { items, total } = await listUsers(page, 20);

  return (
    <div>
      <h1 className="text-2xl font-semibold text-slate-900">Users</h1>
      <p className="mt-1 text-sm text-slate-500">{total} user{total === 1 ? "" : "s"}</p>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[640px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-slate-500">
              <th className="py-2 pr-4">Name</th>
              <th className="py-2 pr-4">Email</th>
              <th className="py-2 pr-4">Joined</th>
              <th className="py-2 pr-4">Role / status</th>
            </tr>
          </thead>
          <tbody>
            {items.map((user) => (
              <tr key={user.id} className="border-b border-slate-100">
                <td className="py-2 pr-4 font-medium text-slate-900">{user.name ?? "—"}</td>
                <td className="py-2 pr-4 text-slate-600">{user.email}</td>
                <td className="py-2 pr-4 text-slate-500">{user.createdAt.toLocaleDateString()}</td>
                <td className="py-2 pr-4">
                  <UserRowActions userId={user.id} role={user.role} banned={Boolean(user.bannedAt)} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
