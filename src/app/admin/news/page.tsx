import { db } from "@/lib/db";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ArticlePublishToggle } from "@/components/admin/article-publish-toggle";
import { DeleteArticleButton } from "@/components/admin/delete-article-button";
import { createArticleAction } from "@/features/admin/news-actions";
import { listCategories } from "@/features/news/news-service";

export const dynamic = "force-dynamic";

export default async function AdminNewsPage() {
  const [articles, categories] = await Promise.all([
    db.newsArticle.findMany({ orderBy: { createdAt: "desc" }, take: 50, include: { category: true } }),
    listCategories(),
  ]);

  return (
    <div>
      <h1 className="text-2xl font-semibold text-slate-900">News articles</h1>
      <p className="mt-1 text-sm text-slate-500">
        Attribute every article to its source — summaries only, never full-text copies.
      </p>

      <form action={createArticleAction} className="mt-4 grid max-w-2xl grid-cols-2 gap-3 rounded-md border border-slate-200 p-4">
        <Input name="title" placeholder="Title" required className="col-span-2" />
        <textarea name="summary" placeholder="Summary" rows={2} required className="col-span-2 rounded-md border border-slate-300 px-3 py-2 text-sm" />
        <Input name="sourceName" placeholder="Source name" required />
        <Input name="sourceUrl" placeholder="Source URL" required type="url" />
        <Input name="imageUrl" placeholder="Image URL (optional)" />
        <Input name="currency" placeholder="Currency (optional)" maxLength={3} />
        <select name="categoryId" defaultValue="" className="h-10 rounded-md border border-slate-300 bg-white px-2 text-sm">
          <option value="">No category</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-2 text-sm text-slate-600">
          <input type="checkbox" name="breaking" /> Breaking
        </label>
        <label className="flex items-center gap-2 text-sm text-slate-600">
          <input type="checkbox" name="publish" /> Publish immediately
        </label>
        <Button type="submit" className="col-span-2">
          Create article
        </Button>
      </form>

      <div className="mt-8 overflow-x-auto">
        <table className="w-full min-w-[720px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-slate-500">
              <th className="py-2 pr-3">Title</th>
              <th className="py-2 pr-3">Source</th>
              <th className="py-2 pr-3">Category</th>
              <th className="py-2 pr-3">Status</th>
              <th className="py-2 pr-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {articles.map((article) => (
              <tr key={article.id} className="border-b border-slate-100">
                <td className="py-2 pr-3 font-medium">
                  {article.title}
                  {article.breaking && <Badge className="ml-2 border-red-200 bg-red-50 text-red-700">Breaking</Badge>}
                </td>
                <td className="py-2 pr-3 text-slate-500">{article.sourceName}</td>
                <td className="py-2 pr-3 text-slate-500">{article.category?.name ?? "—"}</td>
                <td className="py-2 pr-3">
                  <Badge>{article.status}</Badge>
                </td>
                <td className="py-2 pr-3 space-x-2">
                  <ArticlePublishToggle id={article.id} published={article.status === "PUBLISHED"} />
                  <DeleteArticleButton id={article.id} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {articles.length === 0 && <p className="py-8 text-center text-slate-500">No articles yet.</p>}
      </div>
    </div>
  );
}
