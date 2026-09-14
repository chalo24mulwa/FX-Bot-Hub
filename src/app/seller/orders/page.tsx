import { auth } from "@/lib/auth";
import { listSellerOrders } from "@/features/seller/analytics-service";
import { Badge } from "@/components/ui/badge";
import { formatPriceCents } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function SellerOrdersPage() {
  const session = await auth();
  const { items, total } = await listSellerOrders(session!.user.id, 1, 50);

  return (
    <div>
      <h1 className="text-2xl font-semibold text-slate-900">Orders</h1>
      <p className="mt-1 text-sm text-slate-500">{total} order line{total === 1 ? "" : "s"}</p>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[600px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-slate-500">
              <th className="py-2 pr-4">Date</th>
              <th className="py-2 pr-4">Product</th>
              <th className="py-2 pr-4">Buyer</th>
              <th className="py-2 pr-4">Amount</th>
              <th className="py-2 pr-4">Status</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id} className="border-b border-slate-100">
                <td className="py-2 pr-4 text-slate-500">{item.order.createdAt.toLocaleDateString()}</td>
                <td className="py-2 pr-4 font-medium text-slate-900">{item.product.name}</td>
                <td className="py-2 pr-4 text-slate-600">{item.order.user.email}</td>
                <td className="py-2 pr-4 text-slate-600">
                  {formatPriceCents(item.unitPriceCents * item.quantity, item.order.currency)}
                </td>
                <td className="py-2 pr-4">
                  <Badge>{item.order.status}</Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {items.length === 0 && <p className="py-8 text-center text-slate-500">No orders yet.</p>}
      </div>
    </div>
  );
}
