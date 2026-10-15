"use client";

import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { AdminResult } from "@/features/admin/core";
import { cn } from "@/lib/utils";

type Tone = "neutral" | "danger" | "warning" | "success";

const TONES: Record<Tone, string> = {
  neutral: "bg-slate-900 text-white hover:bg-slate-800",
  danger: "bg-red-600 text-white hover:bg-red-700",
  warning: "bg-amber-600 text-white hover:bg-amber-700",
  success: "bg-emerald-600 text-white hover:bg-emerald-700",
};

/**
 * A button that opens a small confirmation: what will happen, a reason (kept in the
 * audit log and often shown to the member), then Confirm. Used for every sensitive
 * admin action so they all behave — and fail — the same way. The server action
 * re-checks permission and rules; nothing here is a security boundary.
 */
export function ReasonAction({
  label,
  confirmLabel,
  description,
  placeholder = "Reason (5+ characters)",
  tone = "neutral",
  reasonRequired = true,
  minLength = 5,
  action,
  onSuccess,
}: {
  label: string;
  confirmLabel?: string;
  description?: string;
  placeholder?: string;
  tone?: Tone;
  reasonRequired?: boolean;
  minLength?: number;
  action: (reason: string) => Promise<AdminResult<object>>;
  onSuccess?: () => void;
}) {
  const router = useRouter();
  const id = useId();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [pending, startTransition] = useTransition();

  const tooShort = reasonRequired && reason.trim().length < minLength;

  function submit() {
    setError(null);
    startTransition(async () => {
      const result = await action(reason.trim());
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setDone(true);
      setOpen(false);
      setReason("");
      onSuccess?.();
      router.refresh();
    });
  }

  if (!open) {
    return (
      <span className="inline-flex flex-col gap-1">
        <button
          type="button"
          onClick={() => {
            setOpen(true);
            setDone(false);
          }}
          className={cn("rounded-md px-3 py-1.5 text-xs font-medium", TONES[tone])}
        >
          {label}
        </button>
        {done && <span role="status" className="text-xs text-emerald-700">Done.</span>}
      </span>
    );
  }

  return (
    <div className="w-full max-w-md rounded-lg border border-slate-300 bg-slate-50 p-3">
      {description && <p className="mb-2 text-xs text-slate-600">{description}</p>}
      <label htmlFor={id} className="mb-1 block text-xs font-medium text-slate-700">
        Reason{reasonRequired ? "" : " (optional)"}
      </label>
      <textarea
        id={id}
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder={placeholder}
        rows={2}
        maxLength={500}
        className="w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm"
      />
      {error && (
        <p role="alert" className="mt-1 text-xs text-red-600">
          {error}
        </p>
      )}
      <div className="mt-2 flex gap-2">
        <button
          type="button"
          disabled={pending || tooShort}
          onClick={submit}
          className={cn("rounded-md px-3 py-1.5 text-xs font-medium disabled:opacity-50", TONES[tone])}
        >
          {pending ? "Working…" : (confirmLabel ?? "Confirm")}
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => {
            setOpen(false);
            setError(null);
          }}
          className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-700"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
