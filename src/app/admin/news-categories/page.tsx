import { db } from "@/lib/db";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { DeleteNewsCategoryButton } from "@/components/admin/delete-news-category-button";
import { createNewsCategoryAction } from "@/features/admin/news-actions";

export const dynamic = "force-dynamic";

export default async function AdminNewsCategoriesPage() {
  const categories = await db.newsCategory.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { articles: true } } },
  });

  return (
    <div>
      <h1 className="text-2xl font-semibold text-slate-900">News categories</h1>

      <form action={createNewsCategoryAction} className="mt-4 flex max-w-md items-end gap-2">
        <label className="flex flex-1 flex-col gap-1 text-xs">
          Name
          <Input name="name" placeholder="e.g. Central Banks" required />
        </label>
        <Button type="submit" size="sm">
          Create
        </Button>
      </form>

      <div className="mt-6 overflow-x-auto">
        <table className="w-full min-w-[420px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-slate-500">
              <th className="py-2 pr-3">Name</th>
              <th className="py-2 pr-3">Slug</th>
              <th className="py-2 pr-3">Articles</th>
              <th className="py-2 pr-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {categories.map((category) => (
              <tr key={category.id} className="border-b border-slate-100">
                <td className="py-2 pr-3 font-medium">{category.name}</td>
                <td className="py-2 pr-3 text-slate-500">{category.slug}</td>
                <td className="py-2 pr-3 text-slate-500">{category._count.articles}</td>
                <td className="py-2 pr-3">
                  <DeleteNewsCategoryButton id={category.id} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {categories.length === 0 && <p className="py-8 text-center text-slate-500">No categories yet.</p>}
      </div>
    </div>
  );
}
