"use client";

import { createPartnerAccountAction, grantMasterPartnerAction, resetUserPasswordAction, setSuspendedAction } from "@/features/admin/control-actions";
import { ReasonAction } from "./reason-action";

export interface PartnerState {
  /** none | PENDING | APPROVED | REJECTED | SUSPENDED */
  status: string;
  masterStatus: string;
}

export function UserAccountControls({
  userId,
  suspended,
  canSuspend,
  canReset,
  resetBlocked,
  canCreatePartner,
  canGrantMaster,
  partner,
}: {
  userId: string;
  suspended: boolean;
  canSuspend: boolean;
  canReset: boolean;
  /** Why a reset can't be sent (e.g. Google-only account), if it can't. */
  resetBlocked: string | null;
  canCreatePartner: boolean;
  canGrantMaster: boolean;
  partner: PartnerState;
}) {
  const needsPartner = partner.status === "none" || partner.status === "PENDING" || partner.status === "REJECTED";
  const masterGrantable = partner.status === "APPROVED" && (partner.masterStatus === "NOT_APPLIED" || partner.masterStatus === "PENDING" || partner.masterStatus === "REJECTED");

  return (
    <div className="flex flex-wrap items-start gap-3">
      {canSuspend &&
        (suspended ? (
          <ReasonAction label="Reactivate account" tone="success" reasonRequired={false} description="The member can sign in again." action={(reason) => setSuspendedAction(userId, false, reason)} />
        ) : (
          <ReasonAction
            label="Suspend account"
            tone="danger"
            description="Signs the member out and blocks sign-in. Their listings, orders, licences and history are kept; this does not delete anything."
            action={(reason) => setSuspendedAction(userId, true, reason)}
          />
        ))}
      {canReset &&
        (resetBlocked ? (
          <p className="max-w-xs text-xs text-slate-500">Password reset unavailable: {resetBlocked}</p>
        ) : (
          <ReasonAction
            label="Send password reset"
            description="Emails the member a one-hour reset link. You never see or set their password."
            confirmLabel="Send link"
            action={(reason) => resetUserPasswordAction(userId, reason)}
          />
        ))}
      {canCreatePartner && needsPartner && (
        <ReasonAction
          label={partner.status === "none" ? "Create Partnership account" : "Approve as Partner"}
          tone="success"
          description="Creates (or approves) their Partner profile and referral link. This does not make them a Master Partner."
          action={(reason) => createPartnerAccountAction(userId, reason)}
        />
      )}
      {canGrantMaster && masterGrantable && (
        <ReasonAction label="Grant Master Partner" tone="warning" description="A separate privilege: lets them recruit Partners and earn the Master override." action={(reason) => grantMasterPartnerAction(userId, reason)} />
      )}
    </div>
  );
}
