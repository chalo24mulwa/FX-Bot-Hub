import Link from "next/link";
import { db } from "@/lib/db";
import { listListings } from "@/features/admin/listing-admin-service";
import { requireAdminPage } from "@/features/admin/viewer";
import { ProductModerationActions } from "@/components/admin/product-moderation-actions";
import { Badge } from "@/components/ui/badge";
import { ProductCover } from "@/components/marketplace/product-cover";

export const dynamic = "force-dynamic";

const STATUS_TABS = ["PENDING_REVIEW", "UNDER_REVIEW", "PUBLISHED", "REJECTED", "SUSPENDED", "DRAFT", "ARCHIVED"] as const;
const STATUS_LABEL: Record<string, string> = { ARCHIVED: "REMOVED" };

type Params = { status?: string; q?: string; seller?: string; category?: string; from?: string; to?: string; page?: string };

const PAGE_SIZE = 20;

function parseDate(value: string | undefined, endOfDay = false): Date | undefined {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
  const d = new Date(`${value}T${endOfDay ? "23:59:59.999" : "00:00:00"}Z`);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

function link(params: Params, patch: Partial<Params>) {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries({ ...params, ...patch })) if (v) qs.set(k, v);
  return `/admin/products?${qs.toString()}`;
}

export default async function AdminProductsPage({ searchParams }: { searchParams: Promise<Params> }) {
  await requireAdminPage("product:moderate");
  const params = await searchParams;
  // "all" shows every status; the queue (pending review) is still the default landing view.
  const status = params.status === "all" ? undefined : (STATUS_TABS as readonly string[]).includes(params.status ?? "") ? params.status : "PENDING_REVIEW";
  const page = Math.max(1, Number.parseInt(params.page ?? "1", 10) || 1);

  const [{ items, total }, categories] = await Promise.all([
    listListings({ status, q: params.q, seller: params.seller, categoryId: params.category, from: parseDate(params.from), to: parseDate(params.to, true) }, page, PAGE_SIZE),
    db.productCategory.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const base: Params = { ...params, status: params.status ?? "PENDING_REVIEW" };
  const field = "h-9 rounded-md border border-slate-300 bg-white px-2 text-sm";

  return (
    <div>
      <h1 className="text-2xl font-semibold text-slate-900">Products</h1>

      <div className="mt-4 flex flex-wrap gap-2">
        {[...STATUS_TABS, "all"].map((tab) => {
          const active = tab === "all" ? params.status === "all" : tab === status;
          return (
            <Link
              key={tab}
              href={link({ ...base, page: undefined }, { status: tab })}
              className={`rounded-full px-3 py-1 text-xs font-medium ${active ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
            >
              {tab === "all" ? "ALL" : (STATUS_LABEL[tab] ?? tab).replace("_", " ")}
            </Link>
          );
        })}
      </div>

      <form method="get" className="mt-3 flex flex-wrap items-end gap-2" role="search" aria-label="Filter listings">
        <input type="hidden" name="status" value={base.status} />
        <label className="grid gap-1 text-xs font-medium text-slate-600">
          Listing
          <input name="q" defaultValue={params.q ?? ""} placeholder="Name or URL slug" className={`${field} w-48`} />
        </label>
        <label className="grid gap-1 text-xs font-medium text-slate-600">
          Seller
          <input name="seller" defaultValue={params.seller ?? ""} placeholder="Name or email" className={`${field} w-48`} />
        </label>
        <label className="grid gap-1 text-xs font-medium text-slate-600">
          Category
          <select name="category" defaultValue={params.category ?? ""} className={field}>
            <option value="">All</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-xs font-medium text-slate-600">
          Updated from
          <input type="date" name="from" defaultValue={params.from ?? ""} className={field} />
        </label>
        <label className="grid gap-1 text-xs font-medium text-slate-600">
          to
          <input type="date" name="to" defaultValue={params.to ?? ""} className={field} />
        </label>
        <button type="submit" className="h-9 rounded-md bg-slate-900 px-3 text-sm font-medium text-white">
          Filter
        </button>
        <Link href={`/admin/products?status=${base.status}`} className="h-9 content-center text-sm text-slate-500 hover:underline">
          Clear
        </Link>
      </form>

      <p className="mt-3 text-sm text-slate-500">
        {total} product{total === 1 ? "" : "s"}
      </p>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[720px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-slate-500">
              <th className="py-2 pr-4">Name</th>
              <th className="py-2 pr-4">Seller</th>
              <th className="py-2 pr-4">Category</th>
              <th className="py-2 pr-4">Status</th>
              <th className="py-2 pr-4">Updated</th>
              <th className="py-2 pr-4">Actions</th>
            </tr>
          </thead>
          <tbody>
            {items.map((product) => (
              <tr key={product.id} className="border-b border-slate-100">
                <td className="py-2 pr-4">
                  <div className="flex items-center gap-3">
                    <ProductCover image={product.images[0]} name={product.name} compact sizes="80px" className="h-12 w-20 rounded" />
                    <Link href={`/admin/products/${product.id}`} className="font-medium text-slate-900 hover:underline">
                      {product.name}
                    </Link>
                    {product.featured && <Badge>Featured</Badge>}
                  </div>
                </td>
                <td className="py-2 pr-4 text-slate-600">{product.seller.name ?? product.seller.email}</td>
                <td className="py-2 pr-4 text-slate-600">{product.category?.name ?? "—"}</td>
                <td className="py-2 pr-4 text-xs text-slate-600">{(STATUS_LABEL[product.status] ?? product.status).replace("_", " ")}</td>
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

      {pages > 1 && (
        <nav className="mt-4 flex items-center justify-between text-sm" aria-label="Pagination">
          {page > 1 ? <Link href={link(base, { page: String(page - 1) })} className="text-blue-600 hover:underline">← Previous</Link> : <span />}
          <span className="text-slate-500">Page {page} of {pages}</span>
          {page < pages ? <Link href={link(base, { page: String(page + 1) })} className="text-blue-600 hover:underline">Next →</Link> : <span />}
        </nav>
      )}
    </div>
  );
}
