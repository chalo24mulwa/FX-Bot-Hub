"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { revokeImpersonationSessionAction } from "@/features/admin/impersonation-actions";

export function RevokeSessionButton({ sessionId }: { sessionId: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  return (
    <span className="inline-flex flex-col items-end gap-1">
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            setError(null);
            const result = await revokeImpersonationSessionAction(sessionId);
            if (!result.ok) return setError(result.error);
            router.refresh();
          })
        }
        className="rounded-md bg-red-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50"
      >
        {pending ? "Ending…" : "End session"}
      </button>
      {error && (
        <span role="alert" className="text-xs text-red-600">
          {error}
        </span>
      )}
    </span>
  );
}
