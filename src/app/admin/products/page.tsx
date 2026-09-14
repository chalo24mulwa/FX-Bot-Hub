import { listProductsForModeration } from "@/server/services/product-service";
import { ProductModerationActions } from "@/components/admin/product-moderation-actions";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";

const STATUS_TABS = ["PENDING_REVIEW", "PUBLISHED", "REJECTED", "SUSPENDED", "DRAFT", "ARCHIVED"] as const;

interface AdminProductsPageProps {
  searchParams: Promise<{ status?: string; page?: string }>;
}

export default async function AdminProductsPage({ searchParams }: AdminProductsPageProps) {
  const params = await searchParams;
  const status = (STATUS_TABS as readonly string[]).includes(params.status ?? "")
    ? (params.status as (typeof STATUS_TABS)[number])
    : "PENDING_REVIEW";
  const page = Number(params.page ?? 1);

  const { items, total } = await listProductsForModeration(status, page, 20);

  return (
    <div>
      <h1 className="text-2xl font-semibold text-slate-900">Products</h1>

      <div className="mt-4 flex flex-wrap gap-2">
        {STATUS_TABS.map((tab) => (
          <a
            key={tab}
            href={`/admin/products?status=${tab}`}
            className={`rounded-full px-3 py-1 text-xs font-medium ${
              tab === status ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            {tab.replace("_", " ")}
          </a>
        ))}
      </div>

      <p className="mt-3 text-sm text-slate-500">{total} product{total === 1 ? "" : "s"}</p>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[720px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-slate-500">
              <th className="py-2 pr-4">Name</th>
              <th className="py-2 pr-4">Seller</th>
              <th className="py-2 pr-4">Category</th>
              <th className="py-2 pr-4">Updated</th>
              <th className="py-2 pr-4">Actions</th>
            </tr>
          </thead>
          <tbody>
            {items.map((product) => (
              <tr key={product.id} className="border-b border-slate-100">
                <td className="py-2 pr-4">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-slate-900">{product.name}</span>
                    {product.featured && <Badge>Featured</Badge>}
                  </div>
                </td>
                <td className="py-2 pr-4 text-slate-600">{product.seller.name}</td>
                <td className="py-2 pr-4 text-slate-600">{product.category?.name ?? "—"}</td>
                <td className="py-2 pr-4 text-slate-500">{product.updatedAt.toLocaleDateString()}</td>
                <td className="py-2 pr-4">
                  <ProductModerationActions productId={product.id} status={product.status} featured={product.featured} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {items.length === 0 && <p className="py-8 text-center text-slate-500">Nothing here.</p>}
      </div>
    </div>
  );
}
