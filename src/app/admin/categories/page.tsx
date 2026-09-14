import { db } from "@/lib/db";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { createCategoryAction } from "@/features/admin/actions";
import { DeleteCategoryButton } from "@/components/admin/delete-category-button";

export const dynamic = "force-dynamic";

export default async function AdminCategoriesPage() {
  const categories = await db.productCategory.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { products: true } } },
  });

  return (
    <div>
      <h1 className="text-2xl font-semibold text-slate-900">Categories</h1>

      <form action={createCategoryAction} className="mt-4 flex max-w-sm gap-2">
        <Input name="name" placeholder="New category name" required />
        <Button type="submit">Add</Button>
      </form>

      <ul className="mt-6 divide-y divide-slate-100">
        {categories.map((c) => (
          <li key={c.id} className="flex items-center justify-between py-3">
            <div>
              <p className="font-medium text-slate-900">{c.name}</p>
              <p className="text-xs text-slate-500">
                {c.slug} · {c._count.products} product{c._count.products === 1 ? "" : "s"}
              </p>
            </div>
            <DeleteCategoryButton categoryId={c.id} disabled={c._count.products > 0} />
          </li>
        ))}
      </ul>
      {categories.length === 0 && <p className="py-8 text-center text-slate-500">No categories yet.</p>}
    </div>
  );
}
