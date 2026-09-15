import { db } from "@/lib/db";
import { listEnabledDataSources, markSyncResult } from "@/repositories/data-source-repository";
import { startSyncLog, finishSyncLog } from "@/repositories/sync-log-repository";
import { getNewsProvider } from "./providers";
import { dispatchNewsAlert } from "@/features/alerts/dispatch-service";
import type { SyncResult } from "@/services/calendar/sync-service";

function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 80);
}

/** Same shape and dedup discipline as runCalendarSync — see its comment. */
export async function runNewsSync(): Promise<SyncResult> {
  const log = await startSyncLog("newsSync");
  let itemsProcessed = 0;
  let itemsFailed = 0;

  try {
    const sources = await listEnabledDataSources("NEWS");

    for (const source of sources) {
      const provider = getNewsProvider(source.providerKey);
      if (!provider) {
        itemsFailed += 1;
        await markSyncResult(source.id, "FAILED");
        continue;
      }

      try {
        const articles = await provider.getLatest(50);
        for (const article of articles) {
          if (!article.externalId) continue;
          const category = article.categorySlug
            ? await db.newsCategory.findUnique({ where: { slug: article.categorySlug } })
            : null;

          const existing = await db.newsArticle.findUnique({ where: { externalId: article.externalId } });
          const saved = await db.newsArticle.upsert({
            where: { externalId: article.externalId },
            update: {
              title: article.title,
              summary: article.summary,
              imageUrl: article.imageUrl,
              breaking: article.breaking ?? false,
            },
            create: {
              externalId: article.externalId,
              slug: slugify(article.title),
              title: article.title,
              summary: article.summary,
              sourceName: article.sourceName,
              sourceUrl: article.sourceUrl,
              imageUrl: article.imageUrl,
              currency: article.currency,
              categoryId: category?.id,
              tags: article.tags ?? [],
              breaking: article.breaking ?? false,
              status: "PUBLISHED",
              publishedAt: article.publishedAt,
            },
          });
          itemsProcessed += 1;

          if (!existing) void dispatchNewsAlert(saved);
        }
        await markSyncResult(source.id, "SUCCESS");
      } catch (err) {
        itemsFailed += 1;
        await markSyncResult(source.id, "FAILED");
        console.error(`[newsSync] provider "${source.providerKey}" failed:`, err);
      }
    }

    await finishSyncLog(log.id, itemsFailed > 0 && itemsProcessed === 0 ? "FAILED" : "SUCCESS", {
      itemsProcessed,
      itemsFailed,
    });
    return { itemsProcessed, itemsFailed };
  } catch (err) {
    await finishSyncLog(log.id, "FAILED", {
      itemsProcessed,
      itemsFailed,
      error: err instanceof Error ? err.message : String(err),
    });
    throw err;
  }
}
