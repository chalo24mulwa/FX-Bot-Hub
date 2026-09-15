"use client";

import { useTransition } from "react";
import { removeSignalAction } from "@/features/admin/signal-actions";

export function RemoveSignalButton({ id, disabled }: { id: string; disabled?: boolean }) {
  const [isPending, startTransition] = useTransition();

  return (
    <button
      disabled={isPending || disabled}
      onClick={() => {
        if (confirm("Remove this signal? It will be marked cancelled and hidden from the public feed.")) {
          startTransition(() => removeSignalAction(id));
        }
      }}
      className="rounded-md border border-red-300 px-2.5 py-1 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
    >
      {disabled ? "Removed" : "Remove"}
    </button>
  );
}
