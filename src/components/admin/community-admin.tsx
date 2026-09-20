"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { CommunityContentStatus, CommunityRestrictionState } from "@prisma/client";
import {
  createCategoryAction,
  liftRestrictionAction,
  moderateCommentAction,
  moderatePostAction,
  resolveReportAction,
  restrictMemberAction,
  setPostFlagAction,
  updateCategoryAction,
} from "@/features/community/moderation-actions";

// Client controls for /admin/community/*. Every button calls a server action
// that re-checks the staff permission and writes the audit trail — nothing
// here is trusted just because the page rendered.

const btn = "rounded-md px-2.5 py-1 text-xs font-medium transition-colors disabled:opacity-50";
const neutral = `${btn} border border-slate-300 bg-white text-slate-700 hover:bg-slate-50`;
const danger = `${btn} bg-red-600 text-white hover:bg-red-700`;
const primary = `${btn} bg-slate-900 text-white hover:bg-slate-800`;

function useRun() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  function run(fn: () => Promise<{ ok: boolean; error?: string }>, after?: () => void) {
    setError(null);
    startTransition(async () => {
      const res = await fn();
      if (res.ok) {
        after?.();
        router.refresh();
      } else setError(res.error ?? "Something went wrong.");
    });
  }
  return { run, pending, error };
}

/** A small inline "why?" prompt used before hiding/removing — the reason is stored and shown to the author. */
function ReasonPrompt({ label, initial = "", onSubmit, onCancel, pending }: { label: string; initial?: string; onSubmit: (reason: string) => void; onCancel: () => void; pending: boolean }) {
  const [reason, setReason] = useState(initial);
  return (
    <div className="mt-2 flex flex-wrap items-center gap-2">
      <input
        autoFocus
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="Reason (shown to the author)"
        aria-label="Reason"
        maxLength={300}
        className="h-8 min-w-[14rem] flex-1 rounded-md border border-slate-300 px-2 text-xs"
      />
      <button type="button" disabled={pending || reason.trim().length < 3} onClick={() => onSubmit(reason)} className={danger}>
        {label}
      </button>
      <button type="button" onClick={onCancel} className={neutral}>
        Cancel
      </button>
    </div>
  );
}

export function PostModerationControls({ postId, status, isPinned, isFeatured, isLocked }: { postId: string; status: CommunityContentStatus; isPinned: boolean; isFeatured: boolean; isLocked: boolean }) {
  const { run, pending, error } = useRun();
  const [prompt, setPrompt] = useState<null | "HIDDEN" | "REMOVED">(null);
  const flag = (f: "isPinned" | "isFeatured" | "isLocked", value: boolean) => run(() => setPostFlagAction(postId, f, value));

  return (
    <div>
      <div className="flex flex-wrap gap-1.5">
        {status === "PUBLISHED" ? (
          <>
            <button type="button" className={neutral} disabled={pending} onClick={() => setPrompt("HIDDEN")}>
              Hide
            </button>
            <button type="button" className={danger} disabled={pending} onClick={() => setPrompt("REMOVED")}>
              Remove
            </button>
          </>
        ) : (
          <button type="button" className={primary} disabled={pending} onClick={() => run(() => moderatePostAction(postId, "PUBLISHED"))}>
            Restore
          </button>
        )}
        {status === "HIDDEN" && (
          <button type="button" className={danger} disabled={pending} onClick={() => setPrompt("REMOVED")}>
            Remove
          </button>
        )}
        <button type="button" className={neutral} disabled={pending} onClick={() => flag("isPinned", !isPinned)}>
          {isPinned ? "Unpin" : "Pin"}
        </button>
        <button type="button" className={neutral} disabled={pending} onClick={() => flag("isFeatured", !isFeatured)}>
          {isFeatured ? "Unfeature" : "Feature"}
        </button>
        <button type="button" className={neutral} disabled={pending} onClick={() => flag("isLocked", !isLocked)}>
          {isLocked ? "Unlock" : "Lock"}
        </button>
      </div>
      {prompt && (
        <ReasonPrompt label={prompt === "HIDDEN" ? "Hide post" : "Remove post"} pending={pending} onCancel={() => setPrompt(null)} onSubmit={(reason) => run(() => moderatePostAction(postId, prompt, reason), () => setPrompt(null))} />
      )}
      {error && (
        <p role="alert" className="mt-1 text-xs text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}

export function ReportActions({ reportId, target, authorUsername }: { reportId: string; target: { kind: "post" | "comment"; id: string; status: CommunityContentStatus } | null; authorUsername: string | null }) {
  const { run, pending, error } = useRun();
  const [prompt, setPrompt] = useState<null | "HIDDEN" | "REMOVED">(null);
  const act = (status: CommunityContentStatus, reason?: string) =>
    target?.kind === "post" ? moderatePostAction(target.id, status, reason) : target ? moderateCommentAction(target.id, status, reason) : Promise.resolve({ ok: false as const, error: "Target missing." });

  return (
    <div>
      <div className="flex flex-wrap gap-1.5">
        {target && target.status === "PUBLISHED" && target.kind === "post" && (
          <button type="button" className={neutral} disabled={pending} onClick={() => setPrompt("HIDDEN")}>
            Hide
          </button>
        )}
        {target && target.status === "PUBLISHED" && (
          <button type="button" className={danger} disabled={pending} onClick={() => setPrompt("REMOVED")}>
            Remove {target.kind}
          </button>
        )}
        <button type="button" className={primary} disabled={pending} onClick={() => run(() => resolveReportAction(reportId, "RESOLVED"))}>
          Mark resolved
        </button>
        <button type="button" className={neutral} disabled={pending} onClick={() => run(() => resolveReportAction(reportId, "DISMISSED"))}>
          Dismiss
        </button>
        {authorUsername && (
          <a href={`/admin/community/members?q=${encodeURIComponent(authorUsername)}`} className={neutral}>
            Restrict author…
          </a>
        )}
      </div>
      {prompt && <ReasonPrompt label={prompt === "HIDDEN" ? "Hide" : "Remove"} pending={pending} initial="" onCancel={() => setPrompt(null)} onSubmit={(reason) => run(() => act(prompt, reason), () => setPrompt(null))} />}
      {error && (
        <p role="alert" className="mt-1 text-xs text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}

const DURATIONS: { label: string; hours: number | null }[] = [
  { label: "24 hours", hours: 24 },
  { label: "3 days", hours: 72 },
  { label: "7 days", hours: 168 },
  { label: "30 days", hours: 720 },
  { label: "90 days", hours: 2160 },
  { label: "Indefinite", hours: null },
];

export function RestrictionForm({ userId, displayName }: { userId: string; displayName: string }) {
  const { run, pending, error } = useRun();
  const [state, setState] = useState<CommunityRestrictionState>("POSTING_SUSPENDED");
  const [duration, setDuration] = useState<string>("168");
  const [startsAt, setStartsAt] = useState("");
  const [reason, setReason] = useState("");
  const [done, setDone] = useState(false);

  const permanent = state === "BANNED";
  const field = "h-9 w-full rounded-md border border-slate-300 bg-white px-2 text-sm";

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        setDone(false);
        run(
          () =>
            restrictMemberAction({
              userId,
              state,
              reason,
              durationHours: permanent || duration === "" ? null : Number(duration),
              startsAt: startsAt ? new Date(startsAt).toISOString() : null,
            }),
          () => {
            setReason("");
            setDone(true);
          }
        );
      }}
      className="space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-4"
    >
      <h3 className="text-sm font-semibold text-slate-900">Restrict {displayName} in the Community</h3>
      <p className="text-xs text-slate-500">Only affects the Community. Their FX Bot Hub account, purchases and downloads keep working.</p>
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="text-xs font-medium text-slate-600">
          Restriction
          <select value={state} onChange={(e) => setState(e.target.value as CommunityRestrictionState)} className={field}>
            <option value="POSTING_SUSPENDED">Suspend posting (can still read &amp; like)</option>
            <option value="COMMUNITY_SUSPENDED">Suspend from Community (read-only)</option>
            <option value="BANNED">Ban permanently</option>
          </select>
        </label>
        <label className="text-xs font-medium text-slate-600">
          Duration
          <select value={permanent ? "" : duration} disabled={permanent} onChange={(e) => setDuration(e.target.value)} className={field}>
            {permanent ? (
              <option value="">Permanent</option>
            ) : (
              DURATIONS.filter((d) => d.hours !== null || state === "POSTING_SUSPENDED").map((d) => (
                <option key={d.label} value={d.hours ?? ""}>
                  {d.label}
                </option>
              ))
            )}
          </select>
        </label>
        <label className="text-xs font-medium text-slate-600">
          Starts (optional, UTC-local)
          <input type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} className={field} />
        </label>
      </div>
      <label className="block text-xs font-medium text-slate-600">
        Reason (recorded and shown to the member)
        <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} maxLength={500} required minLength={3} className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm" />
      </label>
      {error && (
        <p role="alert" className="text-xs text-red-600">
          {error}
        </p>
      )}
      {done && <p role="status" className="text-xs text-emerald-700">Restriction applied.</p>}
      <button type="submit" disabled={pending || reason.trim().length < 3} className={permanent ? danger : primary}>
        {pending ? "Applying…" : permanent ? "Ban from Community" : "Apply restriction"}
      </button>
    </form>
  );
}

export function LiftRestrictionButton({ restrictionId, isBan }: { restrictionId: string; isBan: boolean }) {
  const { run, pending, error } = useRun();
  return (
    <span className="inline-flex flex-col">
      <button type="button" disabled={pending} className={neutral} onClick={() => run(() => liftRestrictionAction(restrictionId, "Lifted by staff"))}>
        {isBan ? "Unban" : "Lift"}
      </button>
      {error && <span role="alert" className="text-xs text-red-600">{error}</span>}
    </span>
  );
}

export function CategoryCreateForm() {
  const { run, pending, error } = useRun();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        run(() => createCategoryAction({ name, description: description || null }), () => {
          setName("");
          setDescription("");
        });
      }}
      className="flex flex-wrap items-end gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4"
    >
      <label className="text-xs font-medium text-slate-600">
        Name
        <input value={name} onChange={(e) => setName(e.target.value)} required minLength={2} maxLength={40} className="mt-1 block h-9 w-56 rounded-md border border-slate-300 px-2 text-sm" />
      </label>
      <label className="min-w-[16rem] flex-1 text-xs font-medium text-slate-600">
        Description (optional)
        <input value={description} onChange={(e) => setDescription(e.target.value)} maxLength={160} className="mt-1 block h-9 w-full rounded-md border border-slate-300 px-2 text-sm" />
      </label>
      <button type="submit" disabled={pending || name.trim().length < 2} className={primary}>
        Add category
      </button>
      {error && <p role="alert" className="w-full text-xs text-red-600">{error}</p>}
    </form>
  );
}

export function CategoryRow({ id, name, slug, description, position, isActive, postCount }: { id: string; name: string; slug: string; description: string | null; position: number; isActive: boolean; postCount: number }) {
  const { run, pending, error } = useRun();
  const [n, setN] = useState(name);
  const [d, setD] = useState(description ?? "");
  const [p, setP] = useState(String(position));
  const dirty = n !== name || d !== (description ?? "") || p !== String(position);
  return (
    <tr className="border-b border-slate-100 align-top">
      <td className="py-2 pr-3">
        <input aria-label={`Name of ${name}`} value={n} onChange={(e) => setN(e.target.value)} className="h-8 w-44 rounded-md border border-slate-300 px-2 text-sm" />
        <div className="mt-0.5 font-mono text-[11px] text-slate-400">/community/c/{slug}</div>
      </td>
      <td className="py-2 pr-3">
        <input aria-label={`Description of ${name}`} value={d} onChange={(e) => setD(e.target.value)} className="h-8 w-full min-w-[14rem] rounded-md border border-slate-300 px-2 text-sm" />
      </td>
      <td className="py-2 pr-3">
        <input aria-label={`Position of ${name}`} type="number" value={p} onChange={(e) => setP(e.target.value)} className="h-8 w-16 rounded-md border border-slate-300 px-2 text-sm" />
      </td>
      <td className="py-2 pr-3 text-sm tabular-nums text-slate-600">{postCount}</td>
      <td className="py-2 pr-3">
        <div className="flex flex-wrap gap-1.5">
          <button type="button" disabled={pending || !dirty} className={primary} onClick={() => run(() => updateCategoryAction(id, { name: n, description: d || null, position: Number(p) }))}>
            Save
          </button>
          <button type="button" disabled={pending} className={isActive ? neutral : primary} onClick={() => run(() => updateCategoryAction(id, { isActive: !isActive }))}>
            {isActive ? "Deactivate" : "Activate"}
          </button>
        </div>
        {error && <p role="alert" className="mt-1 text-xs text-red-600">{error}</p>}
      </td>
    </tr>
  );
}
