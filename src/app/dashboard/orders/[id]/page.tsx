import { notFound } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { Badge } from "@/components/ui/badge";
import { formatPriceCents } from "@/lib/utils";

export const dynamic = "force-dynamic";

interface OrderDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function OrderDetailPage({ params }: OrderDetailPageProps) {
  const { id } = await params;
  const session = await auth();

  const order = await db.order.findUnique({
    where: { id },
    include: {
      items: {
        include: {
          product: {
            include: { versions: { orderBy: { createdAt: "desc" }, take: 1, include: { files: true } } },
          },
        },
      },
      payments: true,
    },
  });
  if (!order || order.userId !== session!.user.id) notFound();

  return (
    <div>
      <div className="flex items-center gap-2">
        <h1 className="text-2xl font-semibold text-slate-900">Order #{order.id.slice(0, 8)}</h1>
        <Badge>{order.status}</Badge>
      </div>
      <p className="mt-1 text-sm text-slate-500">{order.createdAt.toLocaleString()}</p>

      <ul className="mt-6 divide-y divide-slate-100">
        {order.items.map((item) => {
          const files = item.product.versions[0]?.files ?? [];
          return (
            <li key={item.id} className="py-4">
              <div className="flex items-center justify-between">
                <Link href={`/marketplace/${item.product.slug}`} className="font-medium text-slate-900 hover:underline">
                  {item.product.name}
                </Link>
                <span className="text-sm text-slate-600">
                  {formatPriceCents(item.unitPriceCents * item.quantity, order.currency)}
                </span>
              </div>
              {order.status === "PAID" && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {files.length === 0 ? (
                    <span className="text-xs text-slate-400">No files uploaded yet.</span>
                  ) : (
                    files.map((file) => (
                      <a
                        key={file.id}
                        href={`/api/downloads/${file.id}`}
                        className="rounded-md border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
                      >
                        Download {file.fileName} ({file.platform})
                      </a>
                    ))
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>

      <div className="mt-6 flex items-center justify-between border-t border-slate-200 pt-4">
        <span className="font-semibold text-slate-900">Total</span>
        <span className="font-semibold text-slate-900">{formatPriceCents(order.totalCents, order.currency)}</span>
      </div>
    </div>
  );
}
