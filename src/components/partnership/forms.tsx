"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Copy, Share2 } from "lucide-react";
import { applyAsMasterAction, applyAsPartnerAction, requestPayoutAction } from "@/features/partnership/actions";
import type { ActionResult } from "@/features/partnership/core";

// Client-side forms for the Partner dashboard. Every one of them only calls a
// server action; all validation that matters happens again on the server.

function useAction() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const run = (fn: () => Promise<ActionResult>) =>
    start(async () => {
      setError(null);
      const res = await fn();
      if (res.ok) {
        setDone(true);
        router.refresh();
      } else setError(res.error);
    });
  return { pending, error, done, run };
}

function ErrorText({ error }: { error: string | null }) {
  if (!error) return null;
  return (
    <p role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
      {error}
    </p>
  );
}

export function PartnerApplyForm({ reapply = false }: { reapply?: boolean }) {
  const { pending, error, done, run } = useAction();
  const [note, setNote] = useState("");
  const [accept, setAccept] = useState(false);
  if (done) return <p className="rounded-md bg-emerald-50 p-3 text-sm text-emerald-800">Application sent. We&apos;ll let you know once it&apos;s reviewed.</p>;
  return (
    <form
      className="flex max-w-xl flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        run(() => applyAsPartnerAction({ note, acceptTerms: accept }));
      }}
    >
      <label className="flex flex-col gap-1.5 text-sm font-medium text-slate-800" htmlFor="partner-note">
        How will you share FXBotHub? <span className="font-normal text-slate-500">(optional — e.g. your website, channel or community)</span>
        <textarea
          id="partner-note"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          maxLength={1000}
          rows={4}
          className="rounded-md border border-slate-300 px-3 py-2 text-sm font-normal focus:outline-none focus:ring-2 focus:ring-violet-400"
        />
      </label>
      <label className="flex items-start gap-2 text-sm text-slate-700">
        <input type="checkbox" checked={accept} onChange={(e) => setAccept(e.target.checked)} className="mt-0.5 h-4 w-4" />
        <span>
          I&apos;ve read and accept the{" "}
          <Link href="/partnership/terms" className="font-medium text-violet-700 underline" target="_blank">
            Partnership Programme terms
          </Link>
          .
        </span>
      </label>
      <ErrorText error={error} />
      <button
        type="submit"
        disabled={pending || !accept}
        className="inline-flex h-10 w-fit items-center rounded-md bg-violet-600 px-5 text-sm font-semibold text-white hover:bg-violet-500 disabled:opacity-50"
      >
        {pending ? "Sending…" : reapply ? "Apply again" : "Become a Partner"}
      </button>
    </form>
  );
}

export function MasterApplyForm() {
  const { pending, error, done, run } = useAction();
  const [note, setNote] = useState("");
  const [accept, setAccept] = useState(false);
  if (done) return <p className="rounded-md bg-emerald-50 p-3 text-sm text-emerald-800">Application sent. We&apos;ll let you know once it&apos;s reviewed.</p>;
  return (
    <form
      className="flex max-w-xl flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        run(() => applyAsMasterAction({ note, acceptTerms: accept }));
      }}
    >
      <label className="flex flex-col gap-1.5 text-sm font-medium text-slate-800" htmlFor="master-note">
        How will you recruit and support Partners?
        <textarea
          id="master-note"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          minLength={20}
          maxLength={1000}
          rows={5}
          required
          className="rounded-md border border-slate-300 px-3 py-2 text-sm font-normal focus:outline-none focus:ring-2 focus:ring-violet-400"
        />
      </label>
      <label className="flex items-start gap-2 text-sm text-slate-700">
        <input type="checkbox" checked={accept} onChange={(e) => setAccept(e.target.checked)} className="mt-0.5 h-4 w-4" />
        <span>
          I understand Master Partners earn only from eligible sales made by Partners they recruit — never for recruiting itself — and
          that recruitment is limited to one level.
        </span>
      </label>
      <ErrorText error={error} />
      <button
        type="submit"
        disabled={pending || !accept}
        className="inline-flex h-10 w-fit items-center rounded-md bg-violet-600 px-5 text-sm font-semibold text-white hover:bg-violet-500 disabled:opacity-50"
      >
        {pending ? "Sending…" : "Apply to become a Master Partner"}
      </button>
    </form>
  );
}

export function CopyLink({ url, label, shareText }: { url: string; label: string; shareText?: string }) {
  const [copied, setCopied] = useState(false);
  const text = shareText ?? "Trading tools for MT4 and MT5 on FXBotHub";
  const enc = encodeURIComponent;
  const shares = [
    { name: "WhatsApp", href: `https://wa.me/?text=${enc(`${text} ${url}`)}` },
    { name: "Telegram", href: `https://t.me/share/url?url=${enc(url)}&text=${enc(text)}` },
    { name: "X", href: `https://twitter.com/intent/tweet?url=${enc(url)}&text=${enc(text)}` },
    { name: "Facebook", href: `https://www.facebook.com/sharer/sharer.php?u=${enc(url)}` },
    { name: "Email", href: `mailto:?subject=${enc(text)}&body=${enc(url)}` },
  ];
  return (
    <div className="min-w-0">
      <p className="text-sm font-medium text-slate-800">{label}</p>
      <div className="mt-1.5 flex min-w-0 gap-2">
        <input
          readOnly
          value={url}
          aria-label={label}
          onFocus={(e) => e.currentTarget.select()}
          className="h-10 min-w-0 flex-1 rounded-md border border-slate-300 bg-slate-50 px-3 font-mono text-sm text-slate-800"
        />
        <button
          type="button"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(url);
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            } catch {
              setCopied(false);
            }
          }}
          className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-md bg-slate-900 px-3 text-sm font-medium text-white hover:bg-slate-800"
        >
          {copied ? <Check className="h-4 w-4" aria-hidden="true" /> : <Copy className="h-4 w-4" aria-hidden="true" />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
        <span className="inline-flex items-center gap-1 text-slate-500">
          <Share2 className="h-3.5 w-3.5" aria-hidden="true" /> Share:
        </span>
        {shares.map((s) => (
          <a key={s.name} href={s.href} target="_blank" rel="noopener noreferrer" className="font-medium text-violet-700 hover:underline">
            {s.name}
          </a>
        ))}
      </div>
    </div>
  );
}

export function ProductLinkBuilder({ base, code, products }: { base: string; code: string; products: { slug: string; name: string; platform: string }[] }) {
  const [q, setQ] = useState("");
  const [slug, setSlug] = useState("");
  const matches = useMemo(() => {
    const term = q.trim().toLowerCase();
    return (term ? products.filter((p) => p.name.toLowerCase().includes(term)) : products).slice(0, 50);
  }, [q, products]);
  const chosen = products.find((p) => p.slug === slug);
  if (products.length === 0) return <p className="text-sm text-slate-500">No published products to link to yet.</p>;
  return (
    <div className="flex flex-col gap-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm font-medium text-slate-800">
          Find a product
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Type a product name"
            className="h-10 rounded-md border border-slate-300 px-3 text-sm font-normal"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium text-slate-800">
          Product
          <select value={slug} onChange={(e) => setSlug(e.target.value)} className="h-10 rounded-md border border-slate-300 bg-white px-2 text-sm font-normal">
            <option value="">Choose a product…</option>
            {matches.map((p) => (
              <option key={p.slug} value={p.slug}>
                {p.name} ({p.platform.replace("_", "-")})
              </option>
            ))}
          </select>
        </label>
      </div>
      {chosen && <CopyLink url={`${base}/marketplace/${chosen.slug}?ref=${code}`} label={`Link to ${chosen.name}`} shareText={chosen.name} />}
    </div>
  );
}

export function PayoutRequestForm({
  currencies,
  methods,
}: {
  currencies: { currency: string; available: string }[];
  methods: { value: string; label: string }[];
}) {
  const { pending, error, done, run } = useAction();
  const [currency, setCurrency] = useState(currencies[0]?.currency ?? "");
  const [method, setMethod] = useState(methods[0]?.value ?? "");
  const [destination, setDestination] = useState("");
  if (done) return <p className="rounded-md bg-emerald-50 p-3 text-sm text-emerald-800">Payout requested. We&apos;ll review it and let you know.</p>;
  return (
    <form
      className="flex max-w-xl flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        run(() => requestPayoutAction({ currency, method, destination }));
      }}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm font-medium text-slate-800">
          Balance
          <select value={currency} onChange={(e) => setCurrency(e.target.value)} className="h-10 rounded-md border border-slate-300 bg-white px-2 text-sm font-normal">
            {currencies.map((c) => (
              <option key={c.currency} value={c.currency}>
                {c.currency} — {c.available} available
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium text-slate-800">
          Payout method
          <select value={method} onChange={(e) => setMethod(e.target.value)} className="h-10 rounded-md border border-slate-300 bg-white px-2 text-sm font-normal">
            {methods.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label className="flex flex-col gap-1 text-sm font-medium text-slate-800">
        Send it to
        <input
          value={destination}
          onChange={(e) => setDestination(e.target.value)}
          required
          minLength={5}
          maxLength={120}
          placeholder={method === "MPESA" ? "M-Pesa number, e.g. 0712 345 678" : "Bank name, account name and number"}
          className="h-10 rounded-md border border-slate-300 px-3 text-sm font-normal"
        />
        <span className="text-xs font-normal text-slate-500">Used only to send this payout. Never enter a PIN or password.</span>
      </label>
      <p className="text-xs text-slate-500">The request covers your whole approved balance in that currency.</p>
      <ErrorText error={error} />
      <button type="submit" disabled={pending} className="inline-flex h-10 w-fit items-center rounded-md bg-violet-600 px-5 text-sm font-semibold text-white hover:bg-violet-500 disabled:opacity-50">
        {pending ? "Requesting…" : "Request payout"}
      </button>
    </form>
  );
}
