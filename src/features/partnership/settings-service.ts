import { z } from "zod";
import { db } from "@/lib/db";
import { recordAuditLog } from "@/repositories/audit-log-repository";
import { PartnershipError, SETTINGS_ID, getPartnershipSettings } from "./core";

// Programme settings. Changes apply to future sales only — every commission
// row already stores the rate and basis it was calculated with.

const percentToBps = z.coerce.number().min(0).max(100).transform((v) => Math.round(v * 100));

const settingsSchema = z.object({
  programmeOpen: z.boolean(),
  partnerRatePercent: percentToBps,
  masterRatePercent: percentToBps,
  attributionDays: z.coerce.number().int().min(1).max(365),
  referredUserCommissionDays: z.coerce.number().int().min(0).max(3650),
  holdDays: z.coerce.number().int().min(0).max(180),
  minPayout: z.coerce.number().min(0).max(1_000_000).transform((v) => Math.round(v * 100)),
  currencies: z.array(z.string().trim().toUpperCase().regex(/^[A-Z]{3}$/)).min(1).max(10),
  eligibleCategoryIds: z.array(z.string().trim().min(1).max(64)).max(200),
  payoutMethods: z.array(z.enum(["MPESA", "BANK_TRANSFER"])).min(1),
  termsText: z.string().max(40_000).nullable(),
  reason: z.string().trim().min(3, "Give a short reason for the change (kept in the audit log).").max(500),
});

export async function updatePartnershipSettings(actorId: string, raw: unknown) {
  const parsed = settingsSchema.safeParse(raw);
  if (!parsed.success) throw new PartnershipError(parsed.error.issues[0]?.message ?? "Check the settings and try again.");
  const input = parsed.data;
  // (both already converted to basis points by the schema)
  if (input.partnerRatePercent + input.masterRatePercent > 10_000) throw new PartnershipError("Combined rates can't exceed 100%.");

  if (input.eligibleCategoryIds.length > 0) {
    const found = await db.productCategory.count({ where: { id: { in: input.eligibleCategoryIds } } });
    if (found !== input.eligibleCategoryIds.length) throw new PartnershipError("One of the eligible categories no longer exists.");
  }

  const before = await getPartnershipSettings();
  const data = {
    programmeOpen: input.programmeOpen,
    partnerRateBps: input.partnerRatePercent,
    masterRateBps: input.masterRatePercent,
    attributionDays: input.attributionDays,
    referredUserCommissionDays: input.referredUserCommissionDays,
    holdDays: input.holdDays,
    minPayoutCents: input.minPayout,
    currencies: [...new Set(input.currencies)],
    eligibleCategoryIds: [...new Set(input.eligibleCategoryIds)],
    payoutMethods: [...new Set(input.payoutMethods)],
    termsText: input.termsText?.trim() ? input.termsText.trim() : null,
  };
  const after = await db.partnershipSettings.update({ where: { id: SETTINGS_ID }, data });

  const changed = Object.fromEntries(
    (Object.keys(data) as (keyof typeof data)[])
      .filter((k) => JSON.stringify(before[k]) !== JSON.stringify(after[k]))
      .map((k) => [k, k === "termsText" ? { changed: true } : { from: before[k], to: after[k] }]),
  );
  await recordAuditLog({
    actorId,
    action: "partnership.settings.update",
    entityType: "PartnershipSettings",
    entityId: SETTINGS_ID,
    metadata: { reason: input.reason, changed },
  });
  return after;
}
