import { db } from "@/lib/db";
import type { DataSourceKind, SyncStatus } from "@prisma/client";

export async function listDataSources(kind?: DataSourceKind) {
  return db.dataSource.findMany({
    where: kind ? { kind } : undefined,
    orderBy: [{ kind: "asc" }, { name: "asc" }],
  });
}

export async function listEnabledDataSources(kind: DataSourceKind) {
  return db.dataSource.findMany({ where: { kind, enabled: true } });
}

export async function markSyncResult(id: string, status: SyncStatus) {
  return db.dataSource.update({
    where: { id },
    data: { lastSyncAt: new Date(), lastSyncStatus: status },
  });
}

export async function setDataSourceEnabled(id: string, enabled: boolean) {
  return db.dataSource.update({ where: { id }, data: { enabled } });
}

export async function upsertDataSource(input: {
  name: string;
  kind: DataSourceKind;
  providerKey: string;
  enabled?: boolean;
}) {
  return db.dataSource.upsert({
    where: { kind_providerKey: { kind: input.kind, providerKey: input.providerKey } },
    update: { name: input.name },
    create: { ...input, enabled: input.enabled ?? true },
  });
}
