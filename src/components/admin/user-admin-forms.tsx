"use client";

import { useState, useTransition } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import type { UserRole } from "@prisma/client";
import { changeRoleAction, updateUserProfileAction } from "@/features/admin/control-actions";
import { startImpersonationAction } from "@/features/admin/impersonation-actions";

const inputCls = "h-9 w-full rounded-md border border-slate-300 bg-white px-2 text-sm";

export function ProfileEditForm({
  userId,
  initial,
}: {
  userId: string;
  initial: { name: string; displayName: string; bio: string; location: string };
}) {
  const router = useRouter();
  const [values, setValues] = useState(initial);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();
  const set = (key: keyof typeof initial) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setSaved(false);
    setValues((v) => ({ ...v, [key]: e.target.value }));
  };

  return (
    <form
      className="grid max-w-xl gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        startTransition(async () => {
          const result = await updateUserProfileAction(userId, values, reason);
          if (!result.ok) return setError(result.error);
          setSaved(true);
          setReason("");
          router.refresh();
        });
      }}
    >
      <label className="grid gap-1 text-xs font-medium text-slate-700">
        Name
        <input className={inputCls} value={values.name} onChange={set("name")} required minLength={2} maxLength={80} />
      </label>
      <label className="grid gap-1 text-xs font-medium text-slate-700">
        Display name
        <input className={inputCls} value={values.displayName} onChange={set("displayName")} maxLength={80} />
      </label>
      <label className="grid gap-1 text-xs font-medium text-slate-700">
        Location
        <input className={inputCls} value={values.location} onChange={set("location")} maxLength={80} />
      </label>
      <label className="grid gap-1 text-xs font-medium text-slate-700">
        Bio
        <textarea className="rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm" rows={3} value={values.bio} onChange={set("bio")} maxLength={500} />
      </label>
      <label className="grid gap-1 text-xs font-medium text-slate-700">
        Reason for the change (kept in the audit log)
        <input className={inputCls} value={reason} onChange={(e) => setReason(e.target.value)} required minLength={5} maxLength={500} />
      </label>
      {error && (
        <p role="alert" className="text-xs text-red-600">
          {error}
        </p>
      )}
      {saved && (
        <p role="status" className="text-xs text-emerald-700">
          Profile updated.
        </p>
      )}
      <div>
        <button type="submit" disabled={pending || reason.trim().length < 5} className="rounded-md bg-slate-900 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50">
          {pending ? "Saving…" : "Save profile"}
        </button>
      </div>
    </form>
  );
}

const ROLES: UserRole[] = ["USER", "SELLER", "AUTHOR", "MODERATOR", "ADMIN", "SUPER_ADMIN"];

export function RoleChangeForm({ userId, role, assignable }: { userId: string; role: UserRole; assignable: UserRole[] }) {
  const router = useRouter();
  const [next, setNext] = useState<UserRole>(role);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [pending, startTransition] = useTransition();
  const options = ROLES.filter((r) => r === role || assignable.includes(r));

  return (
    <form
      className="grid max-w-md gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        startTransition(async () => {
          const result = await changeRoleAction(userId, next, reason);
          if (!result.ok) return setError(result.error);
          setDone(true);
          setReason("");
          router.refresh();
        });
      }}
    >
      <div className="flex gap-2">
        <select aria-label="Account role" className={inputCls} value={next} onChange={(e) => { setDone(false); setNext(e.target.value as UserRole); }}>
          {options.map((r) => (
            <option key={r} value={r}>
              {r.replace("_", " ")}
            </option>
          ))}
        </select>
      </div>
      <input className={inputCls} placeholder="Reason (5+ characters)" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} />
      {error && (
        <p role="alert" className="text-xs text-red-600">
          {error}
        </p>
      )}
      {done && (
        <p role="status" className="text-xs text-emerald-700">
          Role updated.
        </p>
      )}
      <div>
        <button type="submit" disabled={pending || next === role || reason.trim().length < 5} className="rounded-md bg-slate-900 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50">
          {pending ? "Saving…" : "Change role"}
        </button>
      </div>
    </form>
  );
}

export function ImpersonateForm({ userId, memberName }: { userId: string; memberName: string }) {
  const { update } = useSession();
  const [reason, setReason] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <form
      className="grid max-w-lg gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        startTransition(async () => {
          const result = await startImpersonationAction(userId, reason);
          if (!result.ok) return setError(result.error);
          // Auth.js re-issues the session cookie on every read, so a request that started just before
          // this one can finish after it and put the old cookie back. Confirm the switch took effect and,
          // if not, send the same payload again (the server re-verifies it against the session row).
          for (let attempt = 0; attempt < 4; attempt++) {
            const current = await fetch("/api/auth/session", { cache: "no-store" }).then((r) => r.json()).catch(() => null);
            if (current?.user?.impersonation?.sessionId === result.sessionId) break;
            await update({ startImpersonation: result.sessionId });
          }
          // A full navigation, so the next request carries the switched session cookie.
          window.location.assign(result.redirectTo);
        });
      }}
    >
      <label className="grid gap-1 text-sm font-medium text-slate-700">
        Reason for accessing this account (optional, recorded in the audit log)
        <textarea className="rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm" rows={3} maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Ticket #1234 — member can't see their licence" />
      </label>
      <label className="flex items-start gap-2 text-sm text-slate-700">
        <input type="checkbox" className="mt-1" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} />
        <span>
          I understand I will see {memberName}&apos;s account as they see it, that this session is recorded under my name, and that it ends automatically after 60 minutes.
        </span>
      </label>
      {error && (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}
      <div>
        <button type="submit" disabled={pending || !confirmed} className="rounded-md bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700 disabled:opacity-50">
          {pending ? "Starting…" : "Start session"}
        </button>
      </div>
    </form>
  );
}
