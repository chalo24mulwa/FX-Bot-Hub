import { listCategories } from "@/features/community/queries";
import { CategoryCreateForm, CategoryRow } from "@/components/admin/community-admin";

export const dynamic = "force-dynamic";

export default async function AdminCommunityCategories() {
  const categories = await listCategories({ includeInactive: true });
  return (
    <div className="space-y-6">
      <div>
        <h2 className="mb-2 text-lg font-semibold text-slate-900">Add a category</h2>
        <CategoryCreateForm />
      </div>
      <div>
        <h2 className="mb-2 text-lg font-semibold text-slate-900">Categories</h2>
        <p className="mb-2 text-sm text-slate-500">Lower positions show first. Deactivating hides a category from the site and the post form, but keeps its posts; the URL never changes when you rename it.</p>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-slate-500">
                <th className="py-2 pr-3">Name</th>
                <th className="py-2 pr-3">Description</th>
                <th className="py-2 pr-3">Order</th>
                <th className="py-2 pr-3">Posts</th>
                <th className="py-2 pr-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {categories.map((c) => (
                <CategoryRow key={`${c.id}-${c.updatedAt.getTime()}`} id={c.id} name={c.name} slug={c.slug} description={c.description} position={c.position} isActive={c.isActive} postCount={c.postCount} />
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
