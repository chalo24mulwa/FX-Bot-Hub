"use client";

import { useTransition } from "react";
import { suspendLicenseAction, reactivateLicenseAction, revokeLicenseAction } from "@/features/licenses/actions";

export function LicenseActions({ licenseId, status }: { licenseId: string; status: string }) {
  const [isPending, startTransition] = useTransition();

  if (status === "REVOKED") return <span className="text-xs text-slate-400">Revoked</span>;

  return (
    <div className="flex gap-2">
      {status === "ACTIVE" ? (
        <button
          disabled={isPending}
          onClick={() => startTransition(() => suspendLicenseAction(licenseId))}
          className="rounded-md border border-amber-300 px-2.5 py-1 text-xs font-medium text-amber-700 hover:bg-amber-50 disabled:opacity-50"
        >
          Suspend
        </button>
      ) : (
        <button
          disabled={isPending}
          onClick={() => startTransition(() => reactivateLicenseAction(licenseId))}
          className="rounded-md border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
        >
          Reactivate
        </button>
      )}
      <button
        disabled={isPending}
        onClick={() => {
          if (confirm("Revoke this license permanently? This cannot be undone from this screen.")) {
            startTransition(() => revokeLicenseAction(licenseId));
          }
        }}
        className="rounded-md border border-red-300 px-2.5 py-1 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
      >
        Revoke
      </button>
    </div>
  );
}
