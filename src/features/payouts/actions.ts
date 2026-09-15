"use server";

import { revalidatePath } from "next/cache";
import { requireSession, requirePermission } from "@/lib/authorization";
import * as payoutService from "./payout-service";

export async function requestPayoutAction() {
  const session = await requireSession();
  await payoutService.requestPayout(session.user.id);
  revalidatePath("/seller/payout");
  revalidatePath("/admin/payouts");
}

export async function markPayoutProcessingAction(payoutId: string) {
  const session = await requirePermission("payout:manage");
  await payoutService.markPayoutProcessing(payoutId, session.user.id);
  revalidatePath("/admin/payouts");
}

export async function markPayoutPaidAction(payoutId: string) {
  const session = await requirePermission("payout:manage");
  await payoutService.markPayoutPaid(payoutId, session.user.id);
  revalidatePath("/admin/payouts");
  revalidatePath("/admin/finance");
}

export async function markPayoutFailedAction(payoutId: string) {
  const session = await requirePermission("payout:manage");
  await payoutService.markPayoutFailed(payoutId, session.user.id);
  revalidatePath("/admin/payouts");
}
