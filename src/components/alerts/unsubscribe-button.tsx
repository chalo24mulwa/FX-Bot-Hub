"use client";

import { useTransition } from "react";
import { unsubscribeFromAlertAction } from "@/features/alerts/actions";
import type { AlertType } from "@prisma/client";

export function UnsubscribeButton({ type, targetId }: { type: AlertType; targetId: string }) {
  const [isPending, startTransition] = useTransition();

  return (
    <button
      disabled={isPending}
      onClick={() => startTransition(() => unsubscribeFromAlertAction(type, targetId))}
      className="rounded-md border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
    >
      Unsubscribe
    </button>
  );
}
