"use client";

import { useTransition } from "react";
import { toggleDataSourceAction } from "@/features/admin/data-source-actions";

export function DataSourceToggle({ id, enabled }: { id: string; enabled: boolean }) {
  const [isPending, startTransition] = useTransition();

  return (
    <button
      disabled={isPending}
      onClick={() => startTransition(() => toggleDataSourceAction(id, !enabled))}
      className={`rounded-md px-2.5 py-1 text-xs font-medium disabled:opacity-50 ${
        enabled ? "bg-slate-100 text-slate-700 hover:bg-slate-200" : "bg-emerald-600 text-white hover:bg-emerald-700"
      }`}
    >
      {enabled ? "Disable" : "Enable"}
    </button>
  );
}
