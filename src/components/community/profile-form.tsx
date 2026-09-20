"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { LIMITS } from "@/config/community";
import { updateCommunityProfileAction } from "@/features/community/actions";

// Community profile editing — extends the existing Profile (bio) and adds the
// public username. No second account system: it edits the same Profile row.
export function ProfileForm({ username, bio }: { username: string; bio: string }) {
  const router = useRouter();
  const [name, setName] = useState(username);
  const [about, setAbout] = useState(bio);
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  function save() {
    setMessage(null);
    startTransition(async () => {
      const res = await updateCommunityProfileAction({ username: name, bio: about });
      if (res.ok) {
        setMessage({ tone: "ok", text: "Profile saved." });
        router.refresh();
      } else setMessage({ tone: "error", text: res.error });
    });
  }

  const field = "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500";
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
      className="space-y-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_10px_40px_-12px_rgba(2,6,23,0.6)]"
    >
      <div>
        <label htmlFor="cp-username" className="mb-1 block text-sm font-medium text-slate-700">
          Username
        </label>
        <div className="flex items-center rounded-lg border border-slate-300 focus-within:border-violet-500 focus-within:ring-1 focus-within:ring-violet-500">
          <span className="pl-3 text-slate-400">@</span>
          <input id="cp-username" value={name} onChange={(e) => setName(e.target.value)} maxLength={24} className="w-full rounded-lg px-1.5 py-2 text-sm focus:outline-none" autoComplete="off" />
        </div>
        <p className="mt-1 text-xs text-slate-500">3–24 characters: letters, numbers, underscores. It&apos;s public, and it&apos;s how people @mention you.</p>
      </div>
      <div>
        <label htmlFor="cp-bio" className="mb-1 block text-sm font-medium text-slate-700">
          Bio
        </label>
        <textarea id="cp-bio" value={about} onChange={(e) => setAbout(e.target.value)} rows={4} maxLength={LIMITS.BIO_MAX} className={field} placeholder="Trading style, markets, experience…" />
        <p className="mt-1 text-right text-xs text-slate-400">
          {about.length}/{LIMITS.BIO_MAX}
        </p>
      </div>
      {message && (
        <p role={message.tone === "error" ? "alert" : "status"} className={message.tone === "error" ? "text-sm text-red-600" : "text-sm text-emerald-700"}>
          {message.text}
        </p>
      )}
      <button type="submit" disabled={pending} className="rounded-full bg-slate-900 px-5 py-2 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-60">
        {pending ? "Saving…" : "Save profile"}
      </button>
    </form>
  );
}
