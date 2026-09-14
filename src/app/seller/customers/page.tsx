import { auth } from "@/lib/auth";
import { listSellerCustomers } from "@/features/seller/analytics-service";

export const dynamic = "force-dynamic";

export default async function SellerCustomersPage() {
  const session = await auth();
  const { items, total } = await listSellerCustomers(session!.user.id, 1, 50);

  return (
    <div>
      <h1 className="text-2xl font-semibold text-slate-900">Customers</h1>
      <p className="mt-1 text-sm text-slate-500">{total} customer{total === 1 ? "" : "s"}</p>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[520px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-slate-500">
              <th className="py-2 pr-4">Customer</th>
              <th className="py-2 pr-4">Orders</th>
              <th className="py-2 pr-4">Last purchase</th>
            </tr>
          </thead>
          <tbody>
            {items.map((c) => (
              <tr key={c.email} className="border-b border-slate-100">
                <td className="py-2 pr-4">
                  <p className="font-medium text-slate-900">{c.name ?? "—"}</p>
                  <p className="text-xs text-slate-500">{c.email}</p>
                </td>
                <td className="py-2 pr-4 text-slate-600">{c.orders}</td>
                <td className="py-2 pr-4 text-slate-500">{c.lastPurchase.toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {items.length === 0 && <p className="py-8 text-center text-slate-500">No customers yet.</p>}
      </div>
    </div>
  );
}
