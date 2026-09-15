"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireSession, requirePermission } from "@/lib/authorization";
import { checkRateLimit } from "@/lib/security/rate-limit";
import * as refundService from "./refund-service";

export async function requestRefundAction(orderId: string, reason?: string) {
  const session = await requireSession();
  // Phase 5: no rate limit existed here (docs/PHASE5_AUDIT.md) — the
  // one-active-refund-per-order guard in refund-service.ts limits repeat
  // requests on the *same* order, but not spamming requests across many.
  await checkRateLimit(session.user.id, { bucket: "refund:request", limit: 10, windowSeconds: 3600 });
  const order = await db.order.findUnique({ where: { id: orderId }, select: { userId: true } });
  if (!order || order.userId !== session.user.id) {
    throw new Error("Order not found.");
  }
  await refundService.requestRefund({ orderId, requestedByUserId: session.user.id, reason });
  revalidatePath(`/dashboard/orders/${orderId}`);
  revalidatePath("/admin/refunds");
}

export async function approveRefundAction(refundId: string) {
  const session = await requirePermission("refund:manage");
  await refundService.approveAndProcessRefund(refundId, session.user.id);
  revalidatePath("/admin/refunds");
  revalidatePath("/admin/finance");
}

export async function rejectRefundAction(refundId: string) {
  const session = await requirePermission("refund:manage");
  await refundService.rejectRefund(refundId, session.user.id);
  revalidatePath("/admin/refunds");
}
