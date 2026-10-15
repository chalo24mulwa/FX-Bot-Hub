"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { AdminRole } from "@prisma/client";
import { grantAdminRoleAction, revokeAdminRoleAction } from "@/features/admin/control-actions";
import { ReasonAction } from "./reason-action";

export function AdminRolesPanel({
  userId,
  held,
  labels,
  caps,
}: {
  userId: string;
  held: AdminRole[];
  labels: Record<AdminRole, string>;
  caps: Record<AdminRole, string>;
}) {
  const router = useRouter();
  const available = (Object.keys(labels) as AdminRole[]).filter((r) => !held.includes(r));
  const [role, setRole] = useState<AdminRole | "">(available[0] ?? "");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <div className="grid max-w-xl gap-4">
      {held.length === 0 ? (
        <p className="text-sm text-slate-500">No admin roles. A moderator with none keeps the general moderator access; granting one narrows them to exactly that role&apos;s abilities.</p>
      ) : (
        <ul className="grid gap-2">
          {held.map((r) => (
            <li key={r} className="flex flex-wrap items-start justify-between gap-2 rounded-md border border-slate-200 bg-white p-3">
              <div>
                <p className="text-sm font-medium text-slate-900">{labels[r]}</p>
                <p className="text-xs text-slate-500">{caps[r]}</p>
              </div>
              <ReasonAction
                label="Revoke"
                tone="danger"
                description={held.length === 1 ? "This is their last admin role — revoking it also removes their staff access." : "Their access narrows to the roles they keep."}
                action={(why) => revokeAdminRoleAction(userId, r, why)}
              />
            </li>
          ))}
        </ul>
      )}

      {available.length > 0 && (
        <form
          className="grid gap-2 rounded-md border border-slate-200 bg-slate-50 p-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (!role) return;
            setError(null);
            startTransition(async () => {
              const result = await grantAdminRoleAction(userId, role, reason);
              if (!result.ok) return setError(result.error);
              setReason("");
              router.refresh();
            });
          }}
        >
          <label className="grid gap-1 text-xs font-medium text-slate-700">
            Grant an admin role
            <select className="h-9 rounded-md border border-slate-300 bg-white px-2 text-sm" value={role} onChange={(e) => setRole(e.target.value as AdminRole)}>
              {available.map((r) => (
                <option key={r} value={r}>
                  {labels[r]}
                </option>
              ))}
            </select>
          </label>
          {role && <p className="text-xs text-slate-500">{caps[role]}</p>}
          <input className="h-9 rounded-md border border-slate-300 bg-white px-2 text-sm" placeholder="Reason (5+ characters)" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} />
          {error && (
            <p role="alert" className="text-xs text-red-600">
              {error}
            </p>
          )}
          <div>
            <button type="submit" disabled={pending || !role || reason.trim().length < 5} className="rounded-md bg-slate-900 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50">
              {pending ? "Granting…" : "Grant role"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
