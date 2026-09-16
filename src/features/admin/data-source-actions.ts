"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/authorization";
import { setDataSourceEnabled, upsertDataSource } from "@/repositories/data-source-repository";
import { recordAuditLog } from "@/repositories/audit-log-repository";
import { calendarSyncQueue, SYNC_JOB_OPTIONS } from "@/lib/queue/queues";
import type { DataSourceKind } from "@prisma/client";

export async function toggleDataSourceAction(id: string, enabled: boolean) {
  const session = await requirePermission("data_source:manage");
  await setDataSourceEnabled(id, enabled);
  await recordAuditLog({
    actorId: session.user.id,
    action: enabled ? "data_source.enable" : "data_source.disable",
    entityType: "DataSource",
    entityId: id,
  });
  revalidatePath("/admin/data-sources");
}

export async function registerDataSourceAction(formData: FormData) {
  const session = await requirePermission("data_source:manage");
  const source = await upsertDataSource({
    name: String(formData.get("name") ?? ""),
    kind: String(formData.get("kind") ?? "CALENDAR") as DataSourceKind,
    providerKey: String(formData.get("providerKey") ?? ""),
  });
  await recordAuditLog({ actorId: session.user.id, action: "data_source.register", entityType: "DataSource", entityId: source.id });
  revalidatePath("/admin/data-sources");
}

/** Enqueues one calendarSync run right now — requires a running
 * `npm run worker:calendar-sync` process (or any process consuming the
 * "calendar-sync" queue) to actually pick it up; there is no in-process
 * scheduler (see CLAUDE.md's established "external cron triggers a job"
 * model — this is the same queue that model enqueues onto, just triggered
 * from the admin UI instead of a cron tick). */
export async function triggerCalendarSyncAction() {
  const session = await requirePermission("data_source:manage");
  const job = await calendarSyncQueue.add("manual", {}, SYNC_JOB_OPTIONS);
  await recordAuditLog({ actorId: session.user.id, action: "data_source.trigger_sync", entityType: "DataSource", entityId: "calendar" });
  revalidatePath("/admin/data-sources");
  return { jobId: job.id };
}
