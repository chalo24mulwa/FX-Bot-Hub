"use client";

import { useState, useTransition } from "react";
import { closeSignalAction, cancelSignalAction } from "@/features/signals/actions";

export function ManageSignalActions({ signalId }: { signalId: string }) {
  const [isPending, startTransition] = useTransition();
  const [resultPips, setResultPips] = useState("");
  const [showClose, setShowClose] = useState(false);

  if (showClose) {
    return (
      <div className="flex items-center gap-2">
        <input
          type="number"
          step="any"
          value={resultPips}
          onChange={(e) => setResultPips(e.target.value)}
          placeholder="Result (pips)"
          className="h-8 w-28 rounded border border-slate-300 px-2 text-xs"
        />
        <button
          disabled={isPending || resultPips === ""}
          onClick={() => startTransition(() => closeSignalAction(signalId, Number(resultPips)))}
          className="rounded-md bg-slate-900 px-2.5 py-1 text-xs font-medium text-white disabled:opacity-50"
        >
          Confirm close
        </button>
        <button onClick={() => setShowClose(false)} className="text-xs text-slate-500">
          Cancel
        </button>
      </div>
    );
  }

  return (
    <div className="flex gap-2">
      <button
        disabled={isPending}
        onClick={() => setShowClose(true)}
        className="rounded-md border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
      >
        Close
      </button>
      <button
        disabled={isPending}
        onClick={() => startTransition(() => cancelSignalAction(signalId))}
        className="rounded-md border border-red-300 px-2.5 py-1 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
      >
        Cancel
      </button>
    </div>
  );
}
