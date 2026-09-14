import Link from "next/link";
import { auth } from "@/lib/auth";
import { listSellerProducts } from "@/server/services/product-service";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

interface SellerProductsPageProps {
  searchParams: Promise<{ page?: string }>;
}

export default async function SellerProductsPage({ searchParams }: SellerProductsPageProps) {
  const session = await auth();
  const params = await searchParams;
  const page = Number(params.page ?? 1);
  const { items, total } = await listSellerProducts(session!.user.id, page, 20);

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-slate-900">My products</h1>
        <Link href="/seller/products/new" className={cn(buttonVariants({ size: "sm" }))}>
          New product
        </Link>
      </div>
      <p className="mt-1 text-sm text-slate-500">{total} product{total === 1 ? "" : "s"}</p>

      <div className="mt-4 divide-y divide-slate-100">
        {items.map((product) => (
          <Link
            key={product.id}
            href={`/seller/products/${product.id}`}
            className="flex items-center justify-between gap-4 py-3 hover:bg-slate-50"
          >
            <div>
              <p className="font-medium text-slate-900">{product.name}</p>
              <p className="text-xs text-slate-500">
                {product._count.downloads} downloads · {product._count.orderItems} sales
              </p>
            </div>
            <Badge>{product.status.replace("_", " ")}</Badge>
          </Link>
        ))}
        {items.length === 0 && (
          <p className="py-8 text-center text-slate-500">
            No products yet. <Link href="/seller/products/new" className="text-blue-600 hover:underline">Create your first one</Link>.
          </p>
        )}
      </div>
    </div>
  );
}
