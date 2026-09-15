"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireSession, requirePermission } from "@/lib/authorization";
import * as refundService from "./refund-service";

export async function requestRefundAction(orderId: string, reason?: string) {
  const session = await requireSession();
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
