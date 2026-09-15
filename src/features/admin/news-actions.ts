"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/authorization";
import { db } from "@/lib/db";
import { recordAuditLog } from "@/repositories/audit-log-repository";

function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 80);
}

export async function createArticleAction(formData: FormData) {
  const session = await requirePermission("news:manage");
  const title = String(formData.get("title") ?? "");
  const categoryId = String(formData.get("categoryId") ?? "") || undefined;
  const publish = formData.get("publish") === "on";

  const article = await db.newsArticle.create({
    data: {
      slug: slugify(title) + "-" + Date.now().toString(36),
      title,
      summary: String(formData.get("summary") ?? ""),
      sourceName: String(formData.get("sourceName") ?? ""),
      sourceUrl: String(formData.get("sourceUrl") ?? ""),
      imageUrl: String(formData.get("imageUrl") ?? "") || undefined,
      currency: String(formData.get("currency") ?? "") || undefined,
      categoryId,
      breaking: formData.get("breaking") === "on",
      status: publish ? "PUBLISHED" : "DRAFT",
      publishedAt: publish ? new Date() : undefined,
    },
  });

  await recordAuditLog({ actorId: session.user.id, action: "news_article.create", entityType: "NewsArticle", entityId: article.id });
  revalidatePath("/admin/news");
  revalidatePath("/news");
}

export async function togglePublishArticleAction(id: string, publish: boolean) {
  const session = await requirePermission("news:manage");
  await db.newsArticle.update({
    where: { id },
    data: { status: publish ? "PUBLISHED" : "DRAFT", publishedAt: publish ? new Date() : undefined },
  });
  await recordAuditLog({
    actorId: session.user.id,
    action: publish ? "news_article.publish" : "news_article.unpublish",
    entityType: "NewsArticle",
    entityId: id,
  });
  revalidatePath("/admin/news");
  revalidatePath("/news");
}

export async function deleteArticleAction(id: string) {
  const session = await requirePermission("news:manage");
  await db.newsArticle.delete({ where: { id } });
  await recordAuditLog({ actorId: session.user.id, action: "news_article.delete", entityType: "NewsArticle", entityId: id });
  revalidatePath("/admin/news");
  revalidatePath("/news");
}

export async function createNewsCategoryAction(formData: FormData) {
  await requirePermission("news:manage");
  const name = String(formData.get("name") ?? "").trim();
  if (!name) throw new Error("Name is required.");
  await db.newsCategory.create({ data: { name, slug: slugify(name) } });
  revalidatePath("/admin/news-categories");
}

export async function deleteNewsCategoryAction(id: string) {
  await requirePermission("news:manage");
  await db.newsCategory.delete({ where: { id } });
  revalidatePath("/admin/news-categories");
}
