"use client";

import { useTransition } from "react";
import { deleteEconomicEventAction } from "@/features/admin/calendar-actions";

export function DeleteEventButton({ id }: { id: string }) {
  const [isPending, startTransition] = useTransition();

  return (
    <button
      disabled={isPending}
      onClick={() => {
        if (confirm("Delete this event?")) startTransition(() => deleteEconomicEventAction(id));
      }}
      className="rounded-md border border-red-300 px-2.5 py-1 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
    >
      Delete
    </button>
  );
}
