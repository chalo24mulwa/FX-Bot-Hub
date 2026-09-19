import Link from "next/link";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { Badge } from "@/components/ui/badge";
import { formatPriceCents } from "@/lib/utils";
import { ProductCover } from "@/components/marketplace/product-cover";
import { productCoverSelect } from "@/repositories/product-repository";

export const dynamic = "force-dynamic";

export default async function OrdersPage() {
  const session = await auth();
  const orders = await db.order.findMany({
    where: { userId: session!.user.id },
    orderBy: { createdAt: "desc" },
    include: { items: { include: { product: { include: { images: productCoverSelect } } } } },
  });

  return (
    <div>
      <h1 className="text-2xl font-semibold text-slate-900">Orders</h1>
      {orders.length === 0 ? (
        <p className="mt-4 text-slate-500">
          No orders yet. <Link href="/marketplace" className="text-blue-600 hover:underline">Browse the marketplace</Link>.
        </p>
      ) : (
        <ul className="mt-4 divide-y divide-slate-100">
          {orders.map((order) => (
            <li key={order.id}>
              <Link href={`/dashboard/orders/${order.id}`} className="flex items-center justify-between gap-4 py-3 hover:bg-slate-50">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex shrink-0 -space-x-2">
                    {order.items.slice(0, 3).map((i) => (
                      <ProductCover
                        key={i.id}
                        image={i.product.images[0]}
                        name={i.product.name}
                        compact
                        sizes="80px"
                        className="h-12 w-20 rounded border-2 border-white"
                      />
                    ))}
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium text-slate-900">Order #{order.id.slice(0, 8)}</p>
                    <p className="truncate text-xs text-slate-500">
                      {order.items.map((i) => i.product.name).join(", ")}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm text-slate-600">{formatPriceCents(order.totalCents, order.currency)}</span>
                  <Badge>{order.status}</Badge>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
