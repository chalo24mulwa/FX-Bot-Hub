"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/authorization";
import { db } from "@/lib/db";
import { recordAuditLog } from "@/repositories/audit-log-repository";

export async function setProviderVerifiedAction(providerId: string, verified: boolean) {
  const session = await requirePermission("signal:moderate");
  await db.signalProviderProfile.update({ where: { id: providerId }, data: { verified } });
  await recordAuditLog({
    actorId: session.user.id,
    action: verified ? "signal_provider.verify" : "signal_provider.unverify",
    entityType: "SignalProviderProfile",
    entityId: providerId,
  });
  revalidatePath("/admin/signal-providers");
  revalidatePath("/signals");
}

export async function removeSignalAction(signalId: string) {
  const session = await requirePermission("signal:moderate");
  await db.signal.update({ where: { id: signalId }, data: { status: "CANCELLED" } });
  await recordAuditLog({ actorId: session.user.id, action: "signal.moderate_remove", entityType: "Signal", entityId: signalId });
  revalidatePath("/admin/signals");
  revalidatePath("/signals");
}
