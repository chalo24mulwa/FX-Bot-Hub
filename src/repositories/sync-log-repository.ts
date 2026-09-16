import { db } from "@/lib/db";
import type { SyncStatus } from "@prisma/client";

export async function startSyncLog(jobName: string) {
  return db.syncLog.create({ data: { jobName, status: "RUNNING" } });
}

export async function finishSyncLog(
  id: string,
  status: SyncStatus,
  input: {
    itemsProcessed?: number;
    itemsFailed?: number;
    itemsInserted?: number;
    itemsUpdated?: number;
    itemsCancelled?: number;
    error?: string;
  }
) {
  return db.syncLog.update({
    where: { id },
    data: { status, finishedAt: new Date(), ...input },
  });
}

export async function listSyncLogs(jobName?: string, limit = 50) {
  return db.syncLog.findMany({
    where: jobName ? { jobName } : undefined,
    orderBy: { startedAt: "desc" },
    take: limit,
  });
}
