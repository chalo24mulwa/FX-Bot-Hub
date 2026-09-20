"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Flag, X } from "lucide-react";
import { LIMITS, REPORT_REASONS } from "@/config/community";
import { reportContentAction } from "@/features/community/actions";

// "Report" on every post and comment: opens a small modal (reason + optional
// details). Reports land in the moderation queue at /admin/community/reports.

export function ReportButton({
  target,
  signedIn,
  canReport,
  blockedMessage,
  label = "Report",
}: {
  target: { postId?: string; commentId?: string };
  signedIn: boolean;
  canReport: boolean;
  blockedMessage: string | null;
  label?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [details, setDetails] = useState("");
  const [message, setMessage] = useState<{ tone: "error" | "ok"; text: string } | null>(null);
  const [pending, startTransition] = useTransition();
  const firstRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    firstRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  function openDialog() {
    if (!signedIn) return router.push(`/auth/sign-in?callbackUrl=${encodeURIComponent(pathname)}`);
    setMessage(canReport ? null : { tone: "error", text: blockedMessage ?? "You can't report content right now." });
    setOpen(true);
  }

  function submit() {
    if (!reason) return setMessage({ tone: "error", text: "Choose a reason." });
    startTransition(async () => {
      const res = await reportContentAction({ ...target, reason, details: details.trim() || undefined });
      if (res.ok) {
        setMessage({ tone: "ok", text: "Thanks — our moderators will review this." });
        window.setTimeout(() => {
          setOpen(false);
          setReason("");
          setDetails("");
        }, 1400);
      } else {
        setMessage({ tone: "error", text: res.error });
      }
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={openDialog}
        className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs text-slate-400 transition-colors hover:bg-slate-100 hover:text-rose-600"
      >
        <Flag className="h-3.5 w-3.5" aria-hidden="true" />
        {label}
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/70 p-0 backdrop-blur-sm sm:items-center sm:p-4" onClick={() => setOpen(false)}>
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Report content"
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-t-2xl bg-white p-5 shadow-2xl sm:rounded-2xl"
          >
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-base font-semibold text-slate-900">Report this {target.postId ? "post" : "comment"}</h2>
              <button type="button" onClick={() => setOpen(false)} aria-label="Close" className="rounded-lg p-1 text-slate-400 hover:bg-slate-100">
                <X className="h-4 w-4" />
              </button>
            </div>
            <fieldset className="space-y-1.5" disabled={pending || !canReport}>
              <legend className="sr-only">Reason</legend>
              {REPORT_REASONS.map((r, i) => (
                <label key={r.value} className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-slate-700 hover:bg-slate-50">
                  <input ref={i === 0 ? firstRef : undefined} type="radio" name="reason" value={r.value} checked={reason === r.value} onChange={() => setReason(r.value)} className="accent-violet-600" />
                  {r.label}
                </label>
              ))}
            </fieldset>
            <label className="mt-3 block text-sm text-slate-600">
              Details {reason === "OTHER" ? "(required)" : "(optional)"}
              <textarea
                value={details}
                onChange={(e) => setDetails(e.target.value)}
                maxLength={LIMITS.REPORT_DETAILS_MAX}
                rows={3}
                disabled={pending || !canReport}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500"
              />
            </label>
            {message && (
              <p role={message.tone === "error" ? "alert" : "status"} className={message.tone === "error" ? "mt-2 text-sm text-red-600" : "mt-2 text-sm text-emerald-700"}>
                {message.text}
              </p>
            )}
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={() => setOpen(false)} className="rounded-lg px-3 py-2 text-sm text-slate-600 hover:bg-slate-100">
                Cancel
              </button>
              <button
                type="button"
                onClick={submit}
                disabled={pending || !canReport || message?.tone === "ok"}
                className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
              >
                {pending ? "Sending…" : "Submit report"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
