"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveBrokerAction } from "@/features/brokers/actions";
import { BEST_FOR_PRESETS, LIMITS, PLATFORM_PRESETS } from "@/lib/brokers/validation";
import { MAX_LOGO_BYTES } from "@/lib/brokers/logo";

const inputCls = "h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500";
const areaCls = "w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500";
const labelCls = "grid gap-1 text-sm font-medium text-slate-800";
const hintCls = "text-xs font-normal text-slate-500";

export interface BrokerFormValues {
  name: string;
  tagline: string;
  officialUrl: string;
  affiliateUrl: string;
  sponsored: boolean;
  featured: boolean;
  features: string[];
  whySelected: string;
  bestFor: string[];
  platforms: string[];
  instruments: string;
  accountTypes: string;
  minDeposit: string;
  spreadsInfo: string;
  regulation: string;
  rating: string;
  ratingNote: string;
  infoVerifiedAt: string;
  position: string;
  hasLogo: boolean;
}

export const EMPTY_BROKER: BrokerFormValues = {
  name: "", tagline: "", officialUrl: "", affiliateUrl: "", sponsored: false, featured: false, features: [], whySelected: "",
  bestFor: [], platforms: [], instruments: "", accountTypes: "", minDeposit: "", spreadsInfo: "", regulation: "",
  rating: "", ratingNote: "", infoVerifiedAt: "", position: "", hasLogo: false,
};

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <fieldset className="grid gap-4 rounded-xl border border-slate-200 bg-white p-5">
      <legend className="px-1 text-sm font-semibold text-slate-900">{title}</legend>
      {hint && <p className={`-mt-2 ${hintCls}`}>{hint}</p>}
      {children}
    </fieldset>
  );
}

function Checks({ name, legend, presets, selected, custom }: { name: string; legend: string; presets: readonly string[]; selected: string[]; custom: string }) {
  return (
    <div className="grid gap-2">
      <span className="text-sm font-medium text-slate-800" id={`${name}-legend`}>{legend}</span>
      <div role="group" aria-labelledby={`${name}-legend`} className="flex flex-wrap gap-x-5 gap-y-2">
        {presets.map((preset) => (
          <label key={preset} className="flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" name={name} value={preset} defaultChecked={selected.includes(preset)} className="h-4 w-4 rounded border-slate-300" />
            {preset}
          </label>
        ))}
      </div>
      <label className={labelCls}>
        <span className="text-xs font-medium text-slate-600">Other (comma-separated)</span>
        <input id={`${name}Custom`} name={`${name}Custom`} defaultValue={custom} className={inputCls} maxLength={200} />
      </label>
    </div>
  );
}

interface Props {
  /** Present when editing; absent when creating. */
  brokerId?: string;
  initial?: BrokerFormValues;
}

export function BrokerForm({ brokerId, initial = EMPTY_BROKER }: Props) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();
  const customOf = (selected: string[], presets: readonly string[]) => selected.filter((s) => !presets.includes(s)).join(", ");

  return (
    <form
      className="grid max-w-3xl gap-5"
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        setSaved(false);
        const form = new FormData(e.currentTarget);
        const logo = form.get("logo");
        if (logo instanceof File && logo.size > MAX_LOGO_BYTES) return setError(`The logo must be ${Math.round(MAX_LOGO_BYTES / 1024)} KB or smaller.`);
        startTransition(async () => {
          const result = await saveBrokerAction(brokerId ?? null, form);
          if (!result.ok) return setError(result.error);
          if (!brokerId) return router.push(`/admin/brokers/${result.id}?created=1`);
          setSaved(true);
          router.refresh();
        });
      }}
    >
      <Section title="Basics">
        <label className={labelCls}>
          Broker name
          <input id="name" name="name" defaultValue={initial.name} required minLength={2} maxLength={LIMITS.name} className={inputCls} />
        </label>
        <label className={labelCls}>
          Tagline <span className={hintCls}>Optional, one line shown under the name.</span>
          <input id="tagline" name="tagline" defaultValue={initial.tagline} maxLength={LIMITS.tagline} className={inputCls} />
        </label>
        <div className="grid gap-2">
          <label className={labelCls} htmlFor="logo">
            Logo <span className={hintCls}>PNG, JPG or WebP, up to {Math.round(MAX_LOGO_BYTES / 1024)} KB. Square or wide logos on a plain background work best.</span>
          </label>
          <input id="logo" name="logo" type="file" accept="image/png,image/jpeg,image/webp" className="text-sm" />
          {initial.hasLogo && (
            <label className="flex items-center gap-2 text-xs text-slate-600">
              <input type="checkbox" name="removeLogo" className="h-4 w-4 rounded border-slate-300" /> Remove the current logo (uploading a new file replaces it anyway)
            </label>
          )}
        </div>
      </Section>

      <Section title="Links and disclosure" hint="Only https:// addresses are accepted. The affiliate link, when set, becomes the main button and is labelled as an affiliate link on the page.">
        <label className={labelCls}>
          Official website
          <input id="officialUrl" name="officialUrl" type="url" inputMode="url" defaultValue={initial.officialUrl} required maxLength={LIMITS.url} placeholder="https://www.broker.com" className={inputCls} />
        </label>
        <label className={labelCls}>
          Affiliate / referral link <span className={hintCls}>Optional — your approved registration link.</span>
          <input id="affiliateUrl" name="affiliateUrl" type="url" inputMode="url" defaultValue={initial.affiliateUrl} maxLength={LIMITS.url} placeholder="https://…" className={inputCls} />
        </label>
        <label className="flex items-start gap-2 text-sm text-slate-700">
          <input type="checkbox" name="sponsored" defaultChecked={initial.sponsored} className="mt-0.5 h-4 w-4 rounded border-slate-300" />
          <span>This is a sponsored / paid placement <span className={hintCls}>(adds a “Sponsored placement” label to the listing)</span></span>
        </label>
        <label className="flex items-start gap-2 text-sm text-slate-700">
          <input type="checkbox" name="featured" defaultChecked={initial.featured} className="mt-0.5 h-4 w-4 rounded border-slate-300" />
          <span>Feature this broker <span className={hintCls}>(highlighted card)</span></span>
        </label>
      </Section>

      <Section title="Why this broker">
        <label className={labelCls}>
          Key features and advantages <span className={hintCls}>One per line, up to {LIMITS.features}.</span>
          <textarea id="features" name="features" defaultValue={initial.features.join("\n")} rows={5} className={areaCls} />
        </label>
        <label className={labelCls}>
          Why we selected this broker <span className={hintCls}>Shown on the card and profile. Plain text; no profit or performance guarantees.</span>
          <textarea id="whySelected" name="whySelected" defaultValue={initial.whySelected} rows={4} maxLength={LIMITS.why} className={areaCls} />
        </label>
        <Checks name="bestFor" legend="Best for" presets={BEST_FOR_PRESETS} selected={initial.bestFor} custom={customOf(initial.bestFor, BEST_FOR_PRESETS)} />
      </Section>

      <Section title="Verified details" hint="Only enter what you have checked. Anything left blank is shown to visitors as “Not provided”. If you fill any of these (or a rating), add the verification date below.">
        <Checks name="platforms" legend="Trading platforms" presets={PLATFORM_PRESETS} selected={initial.platforms} custom={customOf(initial.platforms, PLATFORM_PRESETS)} />
        <label className={labelCls}>
          Minimum deposit
          <input id="minDeposit" name="minDeposit" defaultValue={initial.minDeposit} maxLength={LIMITS.short} placeholder="e.g. $100 on the standard account" className={inputCls} />
        </label>
        <label className={labelCls}>
          Account types
          <textarea id="accountTypes" name="accountTypes" defaultValue={initial.accountTypes} rows={2} maxLength={LIMITS.medium} className={areaCls} />
        </label>
        <label className={labelCls}>
          Supported instruments
          <textarea id="instruments" name="instruments" defaultValue={initial.instruments} rows={2} maxLength={LIMITS.medium} className={areaCls} />
        </label>
        <label className={labelCls}>
          Spreads and costs
          <textarea id="spreadsInfo" name="spreadsInfo" defaultValue={initial.spreadsInfo} rows={2} maxLength={LIMITS.medium} className={areaCls} />
        </label>
        <label className={labelCls}>
          Regulation and licensing <span className={hintCls}>Name the regulator and entity, as shown on the regulator&apos;s own register.</span>
          <textarea id="regulation" name="regulation" defaultValue={initial.regulation} rows={3} maxLength={LIMITS.regulation} className={areaCls} />
        </label>
        <label className={labelCls}>
          Information verified on
          <input id="infoVerifiedAt" name="infoVerifiedAt" type="date" defaultValue={initial.infoVerifiedAt} className={`${inputCls} max-w-[12rem]`} />
        </label>
      </Section>

      <Section title="Rating and ranking" hint="A rating is an editorial score from 0.0 to 5.0 on the scale explained on the public page; leave it blank to show “Not rated”.">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className={labelCls}>
            Rating (0–5)
            <input id="rating" name="rating" type="number" min={0} max={5} step={0.1} defaultValue={initial.rating} className={inputCls} />
          </label>
          <label className={labelCls}>
            Ranking position <span className={hintCls}>Place among published brokers (1 = top). Blank keeps the current place.</span>
            <input id="position" name="position" type="number" min={1} max={500} step={1} defaultValue={initial.position} className={inputCls} />
          </label>
        </div>
        <label className={labelCls}>
          Rating note <span className={hintCls}>Optional — what the rating is based on.</span>
          <input id="ratingNote" name="ratingNote" defaultValue={initial.ratingNote} maxLength={LIMITS.ratingNote} className={inputCls} />
        </label>
      </Section>

      {error && (
        <p role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}
      {saved && (
        <p role="status" className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          Saved. Publish it from the buttons above when it&apos;s ready.
        </p>
      )}
      <div>
        <button type="submit" disabled={pending} className="rounded-md bg-slate-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50">
          {pending ? "Saving…" : brokerId ? "Save broker" : "Create broker"}
        </button>
      </div>
    </form>
  );
}
