"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp } from "lucide-react";
import type { VpsStatus } from "@prisma/client";
import { deleteVpsAction, moveVpsAction, vpsStatusAction } from "@/features/vps/actions";

const btn =
  "rounded-md border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-800 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500";

interface Props {
  id: string;
  name: string;
  status: VpsStatus;
  /** Show the up/down controls (not for archived providers). */
  rankable: boolean;
  isFirst: boolean;
  isLast: boolean;
}

/** Publish / unpublish / archive / restore / delete / move for one provider. Every call re-checks permission server-side. */
export function VpsRowActions({ id, name, status, rankable, isFirst, isLast }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const run = (task: () => Promise<{ ok: boolean; error?: string }>) =>
    startTransition(async () => {
      setError(null);
      const result = await task();
      if (!result.ok) return setError(result.error ?? "That didn't work. Please try again.");
      router.refresh();
    });

  return (
    <div className="flex flex-col items-end gap-1.5">
      <div className="flex flex-wrap items-center justify-end gap-1.5">
        {rankable && (
          <>
            <button type="button" className={btn} disabled={pending || isFirst} aria-label={`Move ${name} up`} onClick={() => run(() => moveVpsAction(id, "up"))}>
              <ArrowUp className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
            <button type="button" className={btn} disabled={pending || isLast} aria-label={`Move ${name} down`} onClick={() => run(() => moveVpsAction(id, "down"))}>
              <ArrowDown className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </>
        )}
        {status === "DRAFT" && (
          <button type="button" className={`${btn} border-emerald-300 bg-emerald-50 text-emerald-900 hover:bg-emerald-100`} disabled={pending} onClick={() => run(() => vpsStatusAction(id, "publish"))}>
            Publish
          </button>
        )}
        {status === "PUBLISHED" && (
          <button type="button" className={btn} disabled={pending} onClick={() => run(() => vpsStatusAction(id, "unpublish"))}>
            Unpublish
          </button>
        )}
        {status !== "ARCHIVED" && (
          <button type="button" className={btn} disabled={pending} onClick={() => run(() => vpsStatusAction(id, "archive"))}>
            Archive
          </button>
        )}
        {status === "ARCHIVED" && (
          <button type="button" className={btn} disabled={pending} onClick={() => run(() => vpsStatusAction(id, "restore"))}>
            Restore
          </button>
        )}
        <button
          type="button"
          className={`${btn} border-red-300 text-red-700 hover:bg-red-50`}
          disabled={pending}
          onClick={() => {
            if (window.confirm(`Delete ${name} permanently? This can't be undone (archive it instead to keep the record).`)) run(() => deleteVpsAction(id));
          }}
        >
          Delete
        </button>
      </div>
      {error && (
        <p role="alert" className="max-w-xs text-right text-xs text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}
