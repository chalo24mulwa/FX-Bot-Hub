"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  approveCommissionEarlyAction,
  approvePayoutAction,
  decideMasterAction,
  decidePartnerAction,
  markPayoutPaidAction,
  recalculateOrderAction,
  rejectCommissionAction,
  rejectPayoutAction,
  updateSettingsAction,
} from "@/features/partnership/admin-actions";
import type { ActionResult } from "@/features/partnership/core";
import { cn } from "@/lib/utils";

// Admin controls. Every button calls a server action that re-checks the
// admin's permission and the record's current state; actions that need a
// reason or reference collect it inline (no browser prompt dialogs).

function useRun() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const run = (fn: () => Promise<ActionResult<object>>, success?: (r: object) => string | null) =>
    start(async () => {
      setError(null);
      setMessage(null);
      const res = await fn();
      if (res.ok) {
        setMessage(success ? success(res) : null);
        router.refresh();
      } else setError(res.error);
    });
  return { pending, error, message, run };
}

const btn = (tone: "primary" | "danger" | "plain") =>
  cn(
    "inline-flex h-8 items-center rounded-md px-3 text-xs font-medium disabled:opacity-50",
    tone === "primary" && "bg-emerald-600 text-white hover:bg-emerald-700",
    tone === "danger" && "border border-red-300 text-red-700 hover:bg-red-50",
    tone === "plain" && "border border-slate-300 text-slate-700 hover:bg-slate-50",
  );

interface ActionSpec {
  key: string;
  label: string;
  tone: "primary" | "danger" | "plain";
  /** Asks for text first: a reason, or a reference. */
  input?: { label: string; placeholder?: string };
  call: (text: string) => Promise<ActionResult<object>>;
}

function ActionRow({ actions }: { actions: ActionSpec[] }) {
  const { pending, error, message, run } = useRun();
  const [open, setOpen] = useState<string | null>(null);
  const [text, setText] = useState("");
  const active = actions.find((a) => a.key === open);
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        {actions.map((a) => (
          <button
            key={a.key}
            type="button"
            disabled={pending}
            className={btn(a.tone)}
            onClick={() => {
              if (a.input) {
                setOpen(open === a.key ? null : a.key);
                setText("");
              } else run(() => a.call(""));
            }}
          >
            {a.label}
          </button>
        ))}
      </div>
      {active?.input && (
        <form
          className="flex flex-col gap-2 sm:flex-row"
          onSubmit={(e) => {
            e.preventDefault();
            run(() => active.call(text));
            setOpen(null);
          }}
        >
          <label className="sr-only" htmlFor={`in-${active.key}`}>
            {active.input.label}
          </label>
          <input
            id={`in-${active.key}`}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={active.input.placeholder ?? active.input.label}
            required
            className="h-8 min-w-0 flex-1 rounded-md border border-slate-300 px-2 text-xs"
          />
          <button type="submit" disabled={pending || !text.trim()} className={btn(active.tone)}>
            Confirm {active.label.toLowerCase()}
          </button>
        </form>
      )}
      {error && (
        <p role="alert" className="text-xs text-red-700">
          {error}
        </p>
      )}
      {message && <p className="text-xs text-emerald-700">{message}</p>}
    </div>
  );
}

const REASON = { label: "Reason", placeholder: "Reason (shown to the member, kept in the audit log)" };

export function PartnerDecisionControls({ profileId, status }: { profileId: string; status: string }) {
  const all: ActionSpec[] = [
    { key: "approve", label: status === "REJECTED" ? "Approve anyway" : "Approve", tone: "primary", call: () => decidePartnerAction(profileId, "approve") },
    { key: "reject", label: "Reject", tone: "danger", input: REASON, call: (r) => decidePartnerAction(profileId, "reject", r) },
    { key: "suspend", label: "Suspend", tone: "danger", input: REASON, call: (r) => decidePartnerAction(profileId, "suspend", r) },
    { key: "reactivate", label: "Reactivate", tone: "primary", call: () => decidePartnerAction(profileId, "reactivate") },
  ];
  const allowed: Record<string, string[]> = { PENDING: ["approve", "reject"], REJECTED: ["approve"], APPROVED: ["suspend"], SUSPENDED: ["reactivate"] };
  return <ActionRow actions={all.filter((a) => allowed[status]?.includes(a.key))} />;
}

export function MasterDecisionControls({ profileId, masterStatus, partnerStatus }: { profileId: string; masterStatus: string; partnerStatus: string }) {
  const all: ActionSpec[] = [
    { key: "approve", label: "Approve Master Partner", tone: "primary", call: () => decideMasterAction(profileId, "approve") },
    { key: "reject", label: "Reject Master application", tone: "danger", input: REASON, call: (r) => decideMasterAction(profileId, "reject", r) },
    { key: "suspend", label: "Suspend Master Partner", tone: "danger", input: REASON, call: (r) => decideMasterAction(profileId, "suspend", r) },
    { key: "reactivate", label: "Reactivate Master Partner", tone: "primary", call: () => decideMasterAction(profileId, "reactivate") },
  ];
  const allowed: Record<string, string[]> = {
    PENDING: partnerStatus === "APPROVED" ? ["approve", "reject"] : ["reject"],
    REJECTED: partnerStatus === "APPROVED" ? ["approve"] : [],
    APPROVED: ["suspend"],
    SUSPENDED: partnerStatus === "APPROVED" ? ["reactivate"] : [],
  };
  const actions = all.filter((a) => allowed[masterStatus]?.includes(a.key));
  return actions.length ? <ActionRow actions={actions} /> : null;
}

export function CommissionControls({ id, status, inPaidPayout }: { id: string; status: string; inPaidPayout: boolean }) {
  if (inPaidPayout || (status !== "PENDING" && status !== "APPROVED")) return null;
  const actions: ActionSpec[] = [
    { key: "reject", label: "Reject", tone: "danger", input: REASON, call: (r) => rejectCommissionAction(id, r) },
  ];
  if (status === "PENDING") {
    actions.unshift({
      key: "early",
      label: "Approve early",
      tone: "plain",
      input: { label: "Reason", placeholder: "Why approve before the holding period ends?" },
      call: (r) => approveCommissionEarlyAction(id, r),
    });
  }
  return <ActionRow actions={actions} />;
}

export function PayoutControls({ id, status }: { id: string; status: string }) {
  const actions: ActionSpec[] = [];
  if (status === "REQUESTED") actions.push({ key: "approve", label: "Approve", tone: "primary", call: () => approvePayoutAction(id) });
  if (status === "APPROVED")
    actions.push({
      key: "paid",
      label: "Mark paid",
      tone: "primary",
      input: { label: "Transfer reference", placeholder: "Transfer reference, e.g. M-Pesa code" },
      call: (ref) => markPayoutPaidAction(id, ref),
    });
  if (status === "REQUESTED" || status === "APPROVED")
    actions.push({ key: "reject", label: "Reject", tone: "danger", input: REASON, call: (r) => rejectPayoutAction(id, r) });
  return actions.length ? <ActionRow actions={actions} /> : null;
}

export function RecalculateOrderForm() {
  const { pending, error, message, run } = useRun();
  const [orderId, setOrderId] = useState("");
  return (
    <form
      className="flex flex-col gap-2 sm:flex-row sm:items-end"
      onSubmit={(e) => {
        e.preventDefault();
        run(
          () => recalculateOrderAction(orderId),
          (r) => {
            const created = (r as { created?: number }).created ?? 0;
            return created > 0 ? `Created ${created} commission record(s).` : "No new commission — it already exists or the order isn't eligible.";
          },
        );
      }}
    >
      <label className="flex min-w-0 flex-1 flex-col gap-1 text-xs font-medium text-slate-700">
        Re-check an order (never creates duplicates)
        <input value={orderId} onChange={(e) => setOrderId(e.target.value)} placeholder="Order ID" required className="h-9 rounded-md border border-slate-300 px-2 text-sm font-normal" />
      </label>
      <button type="submit" disabled={pending} className={btn("plain")}>
        Re-check order
      </button>
      {error && <p className="text-xs text-red-700">{error}</p>}
      {message && <p className="text-xs text-emerald-700">{message}</p>}
    </form>
  );
}

export interface SettingsFormValues {
  programmeOpen: boolean;
  partnerRatePercent: number;
  masterRatePercent: number;
  attributionDays: number;
  referredUserCommissionDays: number;
  holdDays: number;
  minPayout: number;
  currencies: string;
  eligibleCategoryIds: string[];
  payoutMethods: string[];
  termsText: string;
}

export function PartnershipSettingsForm({ initial, categories, defaultTerms }: { initial: SettingsFormValues; categories: { id: string; name: string }[]; defaultTerms: string }) {
  const { pending, error, message, run } = useRun();
  const [v, setV] = useState(initial);
  const [reason, setReason] = useState("");
  const set = <K extends keyof SettingsFormValues>(k: K, value: SettingsFormValues[K]) => setV((s) => ({ ...s, [k]: value }));
  const num = (k: keyof SettingsFormValues, label: string, hint: string, step = "1") => (
    <label className="flex flex-col gap-1 text-sm font-medium text-slate-800">
      {label}
      <input
        type="number"
        step={step}
        min={0}
        value={v[k] as number}
        onChange={(e) => set(k, Number(e.target.value) as never)}
        className="h-10 rounded-md border border-slate-300 px-3 text-sm font-normal"
      />
      <span className="text-xs font-normal text-slate-500">{hint}</span>
    </label>
  );
  const toggle = (list: string[], value: string) => (list.includes(value) ? list.filter((x) => x !== value) : [...list, value]);

  return (
    <form
      className="flex flex-col gap-6"
      onSubmit={(e) => {
        e.preventDefault();
        run(
          () =>
            updateSettingsAction({
              ...v,
              currencies: v.currencies.split(",").map((c) => c.trim()).filter(Boolean),
              termsText: v.termsText.trim() ? v.termsText : null,
              reason,
            }),
          () => "Settings saved. They apply to new sales from now on.",
        );
      }}
    >
      <label className="flex items-center gap-2 text-sm font-medium text-slate-800">
        <input type="checkbox" checked={v.programmeOpen} onChange={(e) => set("programmeOpen", e.target.checked)} className="h-4 w-4" />
        Accepting new Partner applications
      </label>
      <div className="grid gap-4 sm:grid-cols-2">
        {num("partnerRatePercent", "Partner commission (%)", "Of the eligible sale amount.", "0.01")}
        {num("masterRatePercent", "Master Partner commission (%)", "Additional, on sales by directly recruited Partners.", "0.01")}
        {num("attributionDays", "Referral window (days)", "How long a referral link click counts.")}
        {num("referredUserCommissionDays", "Referred-account window (days)", "0 = commission on a referred account's purchases for as long as it exists.")}
        {num("holdDays", "Holding period (days)", "Before a commission becomes payable.")}
        {num("minPayout", "Minimum payout", "In each currency's main unit (e.g. 50 = $50.00).", "0.01")}
      </div>
      <label className="flex flex-col gap-1 text-sm font-medium text-slate-800">
        Supported currencies
        <input value={v.currencies} onChange={(e) => set("currencies", e.target.value)} className="h-10 rounded-md border border-slate-300 px-3 text-sm font-normal" />
        <span className="text-xs font-normal text-slate-500">Comma-separated ISO codes, e.g. USD, KES. The first is used for the minimum payout shown in the terms.</span>
      </label>
      <fieldset className="flex flex-col gap-2">
        <legend className="text-sm font-medium text-slate-800">Payout methods offered</legend>
        {[
          ["MPESA", "M-Pesa"],
          ["BANK_TRANSFER", "Bank transfer"],
        ].map(([value, label]) => (
          <label key={value} className="flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" checked={v.payoutMethods.includes(value)} onChange={() => set("payoutMethods", toggle(v.payoutMethods, value))} className="h-4 w-4" />
            {label}
          </label>
        ))}
      </fieldset>
      <fieldset className="flex flex-col gap-2">
        <legend className="text-sm font-medium text-slate-800">Eligible product categories</legend>
        <p className="text-xs text-slate-500">Leave all unticked to make every category eligible.</p>
        <div className="grid max-h-56 gap-1 overflow-y-auto rounded-md border border-slate-200 p-2 sm:grid-cols-2">
          {categories.map((c) => (
            <label key={c.id} className="flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" checked={v.eligibleCategoryIds.includes(c.id)} onChange={() => set("eligibleCategoryIds", toggle(v.eligibleCategoryIds, c.id))} className="h-4 w-4" />
              {c.name}
            </label>
          ))}
          {categories.length === 0 && <span className="text-sm text-slate-500">No categories yet.</span>}
        </div>
      </fieldset>
      <label className="flex flex-col gap-1 text-sm font-medium text-slate-800">
        Programme terms
        <textarea
          value={v.termsText}
          onChange={(e) => set("termsText", e.target.value)}
          rows={14}
          placeholder="Leave empty to use the built-in default terms."
          className="rounded-md border border-slate-300 px-3 py-2 font-mono text-xs font-normal"
        />
        <span className="text-xs font-normal text-slate-500">
          &quot;## &quot; for headings, &quot;- &quot; for bullets, **bold**, [link](/path). Tokens: {"{{partnerRate}} {{masterRate}} {{attributionDays}} {{holdDays}} {{minPayout}} {{ownerWindow}}"}.{" "}
          <button type="button" className="text-violet-700 underline" onClick={() => set("termsText", defaultTerms)}>
            Start from the default terms
          </button>
        </span>
      </label>
      <label className="flex flex-col gap-1 text-sm font-medium text-slate-800">
        Reason for this change
        <input value={reason} onChange={(e) => setReason(e.target.value)} required minLength={3} className="h-10 rounded-md border border-slate-300 px-3 text-sm font-normal" />
        <span className="text-xs font-normal text-slate-500">Recorded in the audit log. Rate changes apply to future sales only.</span>
      </label>
      {error && (
        <p role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}
      {message && <p className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{message}</p>}
      <button type="submit" disabled={pending} className="inline-flex h-10 w-fit items-center rounded-md bg-slate-900 px-5 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50">
        {pending ? "Saving…" : "Save settings"}
      </button>
    </form>
  );
}
