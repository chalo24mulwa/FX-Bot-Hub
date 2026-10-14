"use server";

import { revalidatePath } from "next/cache";
import { PartnershipError, type ActionResult } from "./core";
import { runAdminAction } from "./run-action";
import { decideMaster, decidePartner } from "./partner-service";
import { approveCommissionEarly, recalculateOrderCommissions, rejectCommission } from "./commission-service";
import { approvePartnerPayout, markPartnerPayoutPaid, rejectPartnerPayout } from "./payout-service";
import { updatePartnershipSettings } from "./settings-service";

// Admin Partnership actions — each one calls requirePermission("partnership:manage")
// itself (via runAdminAction), on top of the /admin page gate and layout check.

type Decision = "approve" | "reject" | "suspend" | "reactivate";
const DECISIONS: Decision[] = ["approve", "reject", "suspend", "reactivate"];

function refresh(id?: string) {
  revalidatePath("/admin/partnership");
  if (id) revalidatePath(`/admin/partnership/${id}`);
}

export async function decidePartnerAction(profileId: string, decision: string, reason?: string): Promise<ActionResult> {
  return runAdminAction(async (actorId) => {
    if (!DECISIONS.includes(decision as Decision)) throw new PartnershipError("Unknown decision.");
    await decidePartner(actorId, profileId, decision as Decision, reason);
    refresh(profileId);
    return {};
  });
}

export async function decideMasterAction(profileId: string, decision: string, reason?: string): Promise<ActionResult> {
  return runAdminAction(async (actorId) => {
    if (!DECISIONS.includes(decision as Decision)) throw new PartnershipError("Unknown decision.");
    await decideMaster(actorId, profileId, decision as Decision, reason);
    refresh(profileId);
    return {};
  });
}

export async function rejectCommissionAction(commissionId: string, reason: string): Promise<ActionResult> {
  return runAdminAction(async (actorId) => {
    await rejectCommission(actorId, commissionId, reason);
    revalidatePath("/admin/partnership/commissions");
    return {};
  });
}

export async function approveCommissionEarlyAction(commissionId: string, reason: string): Promise<ActionResult> {
  return runAdminAction(async (actorId) => {
    await approveCommissionEarly(actorId, commissionId, reason);
    revalidatePath("/admin/partnership/commissions");
    return {};
  });
}

export async function recalculateOrderAction(orderId: string): Promise<ActionResult<{ created: number }>> {
  return runAdminAction(async (actorId) => {
    const created = await recalculateOrderCommissions(actorId, orderId);
    revalidatePath("/admin/partnership/commissions");
    return { created };
  });
}

export async function approvePayoutAction(payoutId: string): Promise<ActionResult> {
  return runAdminAction(async (actorId) => {
    await approvePartnerPayout(actorId, payoutId);
    revalidatePath("/admin/partnership/payouts");
    return {};
  });
}

export async function rejectPayoutAction(payoutId: string, reason: string): Promise<ActionResult> {
  return runAdminAction(async (actorId) => {
    await rejectPartnerPayout(actorId, payoutId, reason);
    revalidatePath("/admin/partnership/payouts");
    return {};
  });
}

export async function markPayoutPaidAction(payoutId: string, reference: string): Promise<ActionResult> {
  return runAdminAction(async (actorId) => {
    await markPartnerPayoutPaid(actorId, payoutId, reference);
    revalidatePath("/admin/partnership/payouts");
    return {};
  });
}

export async function updateSettingsAction(input: unknown): Promise<ActionResult> {
  return runAdminAction(async (actorId) => {
    await updatePartnershipSettings(actorId, input);
    revalidatePath("/admin/partnership/settings");
    revalidatePath("/partnership");
    revalidatePath("/partnership/terms");
    return {};
  });
}
