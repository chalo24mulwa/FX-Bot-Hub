"use client";

import { useTransition } from "react";
import { setProviderVerifiedAction } from "@/features/admin/signal-actions";

export function ProviderVerifyToggle({ id, verified }: { id: string; verified: boolean }) {
  const [isPending, startTransition] = useTransition();

  return (
    <button
      disabled={isPending}
      onClick={() => startTransition(() => setProviderVerifiedAction(id, !verified))}
      className={`rounded-md px-2.5 py-1 text-xs font-medium disabled:opacity-50 ${
        verified ? "bg-slate-100 text-slate-700 hover:bg-slate-200" : "bg-blue-600 text-white hover:bg-blue-700"
      }`}
    >
      {verified ? "Unverify" : "Verify"}
    </button>
  );
}
