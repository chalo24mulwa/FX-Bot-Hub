import { notFound } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { Badge } from "@/components/ui/badge";
import { formatPriceCents } from "@/lib/utils";
import { ProductCover } from "@/components/marketplace/product-cover";
import { productCoverSelect } from "@/repositories/product-repository";
import { RequestRefundButton } from "@/components/commerce/request-refund-button";

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
            include: {
              versions: { orderBy: { createdAt: "desc" }, take: 1, include: { files: true } },
              images: productCoverSelect,
            },
          },
          invoice: true,
        },
      },
      payments: true,
      refunds: { orderBy: { createdAt: "desc" }, take: 1 },
    },
  });
  if (!order || order.userId !== session!.user.id) notFound();

  const activeRefund = order.refunds.find((r) => r.status === "REQUESTED" || r.status === "APPROVED");
  const canRequestRefund = order.status === "PAID" && !activeRefund;

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
              <div className="flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <ProductCover image={item.product.images[0]} name={item.product.name} compact sizes="80px" className="h-12 w-20 rounded" />
                  <Link href={`/marketplace/${item.product.slug}`} className="font-medium text-slate-900 hover:underline">
                    {item.product.name}
                  </Link>
                </div>
                <span className="text-sm text-slate-600">
                  {formatPriceCents(item.unitPriceCents * item.quantity, order.currency)}
                </span>
              </div>
              {order.status === "PAID" && (
                <div className="mt-2 flex flex-wrap items-center gap-2">
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
                  {item.invoice && (
                    <Link
                      href={`/invoices/${item.invoice.id}`}
                      className="rounded-md border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
                    >
                      Invoice
                    </Link>
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

      {activeRefund && (
        <p className="mt-4 text-sm text-slate-500">Refund {activeRefund.status.toLowerCase()} — awaiting review.</p>
      )}
      {order.status === "REFUNDED" && <p className="mt-4 text-sm text-emerald-700">This order has been refunded.</p>}
      {canRequestRefund && (
        <div className="mt-4">
          <RequestRefundButton orderId={order.id} />
        </div>
      )}
    </div>
  );
}
