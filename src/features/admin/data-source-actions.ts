"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/authorization";
import { setDataSourceEnabled, upsertDataSource } from "@/repositories/data-source-repository";
import { recordAuditLog } from "@/repositories/audit-log-repository";
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
