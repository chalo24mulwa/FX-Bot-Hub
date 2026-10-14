"use server";

import { revalidatePath } from "next/cache";
import type { ActionResult } from "./core";
import { runMemberAction } from "./run-action";
import { applyAsMaster, applyAsPartner } from "./partner-service";
import { requestPartnerPayout } from "./payout-service";

// Member-facing Partnership actions. Next gives server actions a same-origin
// (CSRF) check; each one requires a session and is rate limited, and the
// service layer re-checks Partner status from the database.

export async function applyAsPartnerAction(input: { note?: string; acceptTerms?: boolean }): Promise<ActionResult> {
  return runMemberAction(
    async (userId) => {
      await applyAsPartner(userId, input);
      revalidatePath("/dashboard/partnership");
      return {};
    },
    { bucket: "partnership:apply", limit: 5, windowSeconds: 3600 },
  );
}

export async function applyAsMasterAction(input: { note?: string; acceptTerms?: boolean }): Promise<ActionResult> {
  return runMemberAction(
    async (userId) => {
      await applyAsMaster(userId, input);
      revalidatePath("/dashboard/partnership/master");
      return {};
    },
    { bucket: "partnership:apply-master", limit: 5, windowSeconds: 3600 },
  );
}

export async function requestPayoutAction(input: { currency?: string; method?: string; destination?: string }): Promise<ActionResult> {
  return runMemberAction(
    async (userId) => {
      await requestPartnerPayout(userId, input);
      revalidatePath("/dashboard/partnership/payouts");
      revalidatePath("/dashboard/partnership");
      return {};
    },
    { bucket: "partnership:payout", limit: 5, windowSeconds: 3600 },
  );
}
