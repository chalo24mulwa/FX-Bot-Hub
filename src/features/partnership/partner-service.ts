import type { MasterPartnerStatus, PartnerStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { notify } from "@/lib/notifications/notify";
import { recordAuditLog } from "@/repositories/audit-log-repository";
import { buildPartnershipUpdateEmail } from "@/emails/templates";
import { resolveSiteUrl } from "@/lib/site-url";
import { generateCode } from "@/lib/partnership/codes";
import { decideRecruiter } from "@/lib/partnership/rules";
import { PartnershipError, getPartnershipSettings, isUniqueViolation, readRecruitCookie } from "./core";

// Partner and Master Partner applications and decisions. Every transition is
// a conditional update (`where: { status: <expected> }`), so two admins — or a
// double click — can never apply conflicting decisions, and each one is
// written to the append-only AuditLog with the actor and reason.

const NOTE_MAX = 1000;
const REASON_MAX = 1000;

const clean = (s: unknown, max: number) => (typeof s === "string" ? s.trim().slice(0, max) : "");

async function notifyMember(userId: string, title: string, message: string) {
  const url = `${resolveSiteUrl().replace(/\/$/, "")}/dashboard/partnership`;
  await notify({
    userId,
    type: "PARTNERSHIP",
    title,
    body: message,
    link: "/dashboard/partnership",
    email: buildPartnershipUpdateEmail(title, message, url),
  }).catch(() => undefined);
}

/** Assigns a unique code, retrying on the (rare) collision. */
async function assignCode(profileId: string, field: "referralCode" | "masterCode") {
  for (let attempt = 0; attempt < 6; attempt++) {
    try {
      await db.partnerProfile.updateMany({ where: { id: profileId, [field]: null }, data: { [field]: generateCode() } });
      return;
    } catch (err) {
      if (!isUniqueViolation(err)) throw err;
    }
  }
  throw new PartnershipError("Couldn't assign a referral code. Please try again.", 500);
}

// ---------------------------------------------------------------------------
// Partner applications
// ---------------------------------------------------------------------------

export async function applyAsPartner(userId: string, input: { note?: unknown; acceptTerms?: unknown }) {
  const settings = await getPartnershipSettings();
  if (!settings.programmeOpen) throw new PartnershipError("The Partnership Programme isn't accepting applications right now.", 403);
  if (input.acceptTerms !== true) throw new PartnershipError("Please read and accept the programme terms to apply.");

  const user = await db.user.findUnique({ where: { id: userId }, select: { id: true, bannedAt: true } });
  if (!user || user.bannedAt) throw new PartnershipError("Your account can't apply right now.", 403);

  const note = clean(input.note, NOTE_MAX) || null;
  const existing = await db.partnerProfile.findUnique({ where: { userId } });
  if (existing?.status === "PENDING") throw new PartnershipError("Your application is already being reviewed.", 409);
  if (existing?.status === "APPROVED") throw new PartnershipError("You're already a Partner.", 409);
  if (existing?.status === "SUSPENDED") throw new PartnershipError("Your Partnership is suspended. Please contact us.", 403);

  // Recruitment through a Master Partner's link: only ever recorded once.
  const now = new Date();
  const recruit = await readRecruitCookie(now, settings.attributionDays);
  const master = recruit
    ? await db.partnerProfile.findUnique({
        where: { masterCode: recruit.code },
        select: { id: true, userId: true, status: true, masterStatus: true, recruitedById: true },
      })
    : null;
  const recruiter = decideRecruiter({
    applicantUserId: userId,
    applicantProfileId: existing?.id ?? null,
    existingRecruitedById: existing?.recruitedById ?? null,
    master,
  });

  let profile;
  if (existing) {
    // Re-applying after a rejection reuses the same row.
    const updated = await db.partnerProfile.updateMany({
      where: { id: existing.id, status: "REJECTED" },
      data: {
        status: "PENDING",
        applicationNote: note,
        appliedAt: now,
        decidedAt: null,
        decidedById: null,
        decisionReason: null,
        ...(recruiter.masterId ? { recruitedById: recruiter.masterId } : {}),
      },
    });
    if (updated.count === 0) throw new PartnershipError("Your application status changed. Please refresh.", 409);
    profile = await db.partnerProfile.findUniqueOrThrow({ where: { id: existing.id } });
  } else {
    try {
      profile = await db.partnerProfile.create({
        data: { userId, applicationNote: note, recruitedById: recruiter.masterId ?? null },
      });
    } catch (err) {
      if (isUniqueViolation(err)) throw new PartnershipError("You've already applied.", 409);
      throw err;
    }
  }

  await recordAuditLog({
    actorId: userId,
    action: "partnership.apply",
    entityType: "PartnerProfile",
    entityId: profile.id,
    metadata: { reapplied: Boolean(existing), proposedRecruiter: recruiter.masterId ?? null },
  });
  return profile;
}

type PartnerDecision = "approve" | "reject" | "suspend" | "reactivate";

const PARTNER_TRANSITIONS: Record<PartnerDecision, { from: PartnerStatus[]; to: PartnerStatus; needsReason: boolean }> = {
  approve: { from: ["PENDING", "REJECTED"], to: "APPROVED", needsReason: false },
  reject: { from: ["PENDING"], to: "REJECTED", needsReason: true },
  suspend: { from: ["APPROVED"], to: "SUSPENDED", needsReason: true },
  reactivate: { from: ["SUSPENDED"], to: "APPROVED", needsReason: false },
};

export async function decidePartner(actorId: string, profileId: string, decision: PartnerDecision, rawReason?: unknown) {
  const rule = PARTNER_TRANSITIONS[decision];
  if (!rule) throw new PartnershipError("Unknown decision.");
  const reason = clean(rawReason, REASON_MAX);
  if (rule.needsReason && !reason) throw new PartnershipError("Please give a reason — it's shown to the member and kept in the audit log.");

  const profile = await db.partnerProfile.findUnique({ where: { id: profileId } });
  if (!profile) throw new PartnershipError("Partner not found.", 404);
  if (profile.userId === actorId) throw new PartnershipError("You can't decide on your own Partnership.", 403);

  const now = new Date();
  const updated = await db.partnerProfile.updateMany({
    where: { id: profileId, status: { in: rule.from } },
    data: { status: rule.to, decidedAt: now, decidedById: actorId, decisionReason: reason || null },
  });
  if (updated.count === 0) throw new PartnershipError(`This Partner can't be moved to ${rule.to.toLowerCase()} from ${profile.status.toLowerCase()}.`, 409);

  if (rule.to === "APPROVED") {
    await assignCode(profileId, "referralCode");
    // Confirm the recruiter proposed at application, if they're still an active Master Partner.
    if (profile.recruitedById && !profile.recruitedAt) {
      const master = await db.partnerProfile.findUnique({ where: { id: profile.recruitedById }, select: { status: true, masterStatus: true } });
      const stillActive = master?.status === "APPROVED" && master.masterStatus === "APPROVED";
      await db.partnerProfile.update({
        where: { id: profileId },
        data: stillActive ? { recruitedAt: now } : { recruitedById: null },
      });
    }
  }

  await recordAuditLog({
    actorId,
    action: `partnership.partner.${decision}`,
    entityType: "PartnerProfile",
    entityId: profileId,
    metadata: { from: profile.status, to: rule.to, reason: reason || null },
  });

  const messages: Record<PartnerDecision, [string, string]> = {
    approve: ["You're now an FXBotHub Partner", "Your application was approved. Your referral links are ready in your Partnership dashboard."],
    reject: ["Your Partner application", `Your application wasn't approved this time. Reason: ${reason}`],
    suspend: ["Your Partnership is suspended", `Your Partnership has been suspended. Reason: ${reason}. You won't earn new commission or be able to request payouts while it's suspended.`],
    reactivate: ["Your Partnership is active again", "Your Partnership has been reactivated. Your referral links work again."],
  };
  const [title, message] = messages[decision];
  void notifyMember(profile.userId, title, message);
  return db.partnerProfile.findUniqueOrThrow({ where: { id: profileId } });
}

// ---------------------------------------------------------------------------
// Master Partner applications
// ---------------------------------------------------------------------------

export async function applyAsMaster(userId: string, input: { note?: unknown; acceptTerms?: unknown }) {
  if (input.acceptTerms !== true) throw new PartnershipError("Please confirm you've read the Master Partner responsibilities.");
  const note = clean(input.note, NOTE_MAX);
  if (note.length < 20) throw new PartnershipError("Please tell us briefly (20+ characters) how you plan to recruit and support Partners.");

  const profile = await db.partnerProfile.findUnique({ where: { userId } });
  if (!profile || profile.status !== "APPROVED") throw new PartnershipError("Only active, approved Partners can apply to become a Master Partner.", 403);

  const updated = await db.partnerProfile.updateMany({
    where: { id: profile.id, status: "APPROVED", masterStatus: { in: ["NOT_APPLIED", "REJECTED"] } },
    data: {
      masterStatus: "PENDING",
      masterApplicationNote: note,
      masterAppliedAt: new Date(),
      masterDecidedAt: null,
      masterDecidedById: null,
      masterDecisionReason: null,
    },
  });
  if (updated.count === 0) {
    const messages: Partial<Record<MasterPartnerStatus, string>> = {
      PENDING: "Your Master Partner application is already being reviewed.",
      APPROVED: "You're already a Master Partner.",
      SUSPENDED: "Your Master Partner status is suspended. Please contact us.",
    };
    throw new PartnershipError(messages[profile.masterStatus] ?? "You can't apply right now.", 409);
  }

  await recordAuditLog({ actorId: userId, action: "partnership.master.apply", entityType: "PartnerProfile", entityId: profile.id });
}

const MASTER_TRANSITIONS: Record<PartnerDecision, { from: MasterPartnerStatus[]; to: MasterPartnerStatus; needsReason: boolean }> = {
  approve: { from: ["PENDING", "REJECTED"], to: "APPROVED", needsReason: false },
  reject: { from: ["PENDING"], to: "REJECTED", needsReason: true },
  suspend: { from: ["APPROVED"], to: "SUSPENDED", needsReason: true },
  reactivate: { from: ["SUSPENDED"], to: "APPROVED", needsReason: false },
};

export async function decideMaster(actorId: string, profileId: string, decision: PartnerDecision, rawReason?: unknown) {
  const rule = MASTER_TRANSITIONS[decision];
  if (!rule) throw new PartnershipError("Unknown decision.");
  const reason = clean(rawReason, REASON_MAX);
  if (rule.needsReason && !reason) throw new PartnershipError("Please give a reason — it's shown to the member and kept in the audit log.");

  const profile = await db.partnerProfile.findUnique({ where: { id: profileId } });
  if (!profile) throw new PartnershipError("Partner not found.", 404);
  if (profile.userId === actorId) throw new PartnershipError("You can't decide on your own Partnership.", 403);
  if (rule.to === "APPROVED" && profile.status !== "APPROVED") {
    throw new PartnershipError("Only an active, approved Partner can be a Master Partner.", 409);
  }

  const updated = await db.partnerProfile.updateMany({
    where: { id: profileId, masterStatus: { in: rule.from }, ...(rule.to === "APPROVED" ? { status: "APPROVED" as const } : {}) },
    data: { masterStatus: rule.to, masterDecidedAt: new Date(), masterDecidedById: actorId, masterDecisionReason: reason || null },
  });
  if (updated.count === 0) throw new PartnershipError(`Master Partner status can't move to ${rule.to.toLowerCase()} from ${profile.masterStatus.toLowerCase()}.`, 409);
  if (rule.to === "APPROVED") await assignCode(profileId, "masterCode");

  await recordAuditLog({
    actorId,
    action: `partnership.master.${decision}`,
    entityType: "PartnerProfile",
    entityId: profileId,
    metadata: { from: profile.masterStatus, to: rule.to, reason: reason || null },
  });

  const messages: Record<PartnerDecision, [string, string]> = {
    approve: ["You're now a Master Partner", "Your Master Partner application was approved. Your recruitment link is ready in your Partnership dashboard."],
    reject: ["Your Master Partner application", `Your Master Partner application wasn't approved this time. Reason: ${reason}`],
    suspend: ["Master Partner status suspended", `Your Master Partner status has been suspended. Reason: ${reason}. You won't earn new Master Partner commission while it's suspended.`],
    reactivate: ["Master Partner status reactivated", "Your Master Partner status is active again."],
  };
  const [title, message] = messages[decision];
  void notifyMember(profile.userId, title, message);
}
