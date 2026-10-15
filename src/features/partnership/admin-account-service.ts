import { db } from "@/lib/db";
import { requireReason } from "@/lib/admin/rules";
import { recordAuditLog } from "@/repositories/audit-log-repository";
import { PartnershipError } from "./core";
import { decideMaster, decidePartner } from "./partner-service";

// Administrator-initiated Partnership accounts. These deliberately go through
// the same decision functions as a normal application (decidePartner /
// decideMaster), so the referral code, recruiter confirmation, member
// notification and audit entry are identical — an admin-created Partner is
// indistinguishable from an approved applicant, apart from the extra audit
// entry recording who created it and why.
//
// Partner and Master Partner are separate privileges: creating a Partner never
// grants Master status, and granting Master is its own audited action.

export async function adminCreatePartnerAccount(actorId: string, userId: string, rawReason: unknown) {
  const reason = requireReason(rawReason);
  if (!reason.ok) throw new PartnershipError(reason.error);

  const user = await db.user.findUnique({ where: { id: userId }, select: { id: true, email: true, bannedAt: true } });
  if (!user) throw new PartnershipError("That member wasn't found.", 404);
  if (user.id === actorId) throw new PartnershipError("You can't create your own Partnership account.", 403);
  if (user.bannedAt) throw new PartnershipError("This account is suspended, so it can't become a Partner.", 403);

  const existing = await db.partnerProfile.findUnique({ where: { userId } });
  if (existing?.status === "APPROVED") throw new PartnershipError("This member is already a Partner.", 409);
  if (existing?.status === "SUSPENDED") {
    throw new PartnershipError("This Partner is suspended. Reactivate them from the Partnership page instead.", 409);
  }

  // One profile per member: reuse a pending/rejected application, otherwise create it.
  const created = !existing;
  const profile = existing ?? (await db.partnerProfile.create({ data: { userId, applicationNote: "Created by an administrator." } }));
  try {
    await decidePartner(actorId, profile.id, "approve", reason.reason);
  } catch (err) {
    // Don't leave a stray pending "application" behind if approval itself failed.
    if (created) await db.partnerProfile.deleteMany({ where: { id: profile.id, status: "PENDING" } });
    throw err;
  }

  await recordAuditLog({
    actorId,
    action: "partnership.admin_create",
    entityType: "PartnerProfile",
    entityId: profile.id,
    metadata: { userId, createdProfile: created, previousStatus: existing?.status ?? null, reason: reason.reason },
  });
  return db.partnerProfile.findUniqueOrThrow({ where: { id: profile.id }, select: { id: true, referralCode: true, status: true } });
}

/** Master Partner status for an already-approved Partner, without needing an application. */
export async function adminGrantMaster(actorId: string, userId: string, rawReason: unknown) {
  const reason = requireReason(rawReason);
  if (!reason.ok) throw new PartnershipError(reason.error);

  const profile = await db.partnerProfile.findUnique({ where: { userId } });
  if (!profile) throw new PartnershipError("This member isn't a Partner yet. Create their Partnership account first.", 404);
  if (profile.userId === actorId) throw new PartnershipError("You can't grant yourself Master Partner status.", 403);
  if (profile.status !== "APPROVED") throw new PartnershipError("Only an active, approved Partner can become a Master Partner.", 409);
  if (profile.masterStatus === "APPROVED") throw new PartnershipError("This Partner is already a Master Partner.", 409);
  if (profile.masterStatus === "SUSPENDED") throw new PartnershipError("This Master Partner is suspended. Reactivate them from the Partnership page instead.", 409);

  if (profile.masterStatus === "NOT_APPLIED") {
    const moved = await db.partnerProfile.updateMany({
      where: { id: profile.id, masterStatus: "NOT_APPLIED", status: "APPROVED" },
      data: { masterStatus: "PENDING", masterApplicationNote: "Granted by an administrator.", masterAppliedAt: new Date() },
    });
    if (moved.count === 0) throw new PartnershipError("This Partner's status changed. Please refresh.", 409);
  }
  await decideMaster(actorId, profile.id, "approve", reason.reason);

  await recordAuditLog({
    actorId,
    action: "partnership.master.admin_grant",
    entityType: "PartnerProfile",
    entityId: profile.id,
    metadata: { userId, previousMasterStatus: profile.masterStatus, reason: reason.reason },
  });
}
