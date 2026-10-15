"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveVpsAction } from "@/features/vps/actions";
import { optimizeForUpload } from "@/lib/vps/client-image";
import { BEST_FOR_PRESETS, CTA_LABELS, LIMITS, OS_PRESETS, PLATFORM_PRESETS } from "@/lib/vps/validation";
import { MAX_VPS_COVER_BYTES, MAX_VPS_LOGO_BYTES } from "@/lib/vps/images";

const inputCls = "h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500";
const areaCls = "w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500";
const labelCls = "grid gap-1 text-sm font-medium text-slate-800";
const hintCls = "text-xs font-normal text-slate-500";

export interface VpsFormValues {
  name: string;
  category: string;
  headline: string;
  description: string;
  officialUrl: string;
  affiliateUrl: string;
  ctaLabel: string;
  promoCode: string;
  offerText: string;
  offerExpiresAt: string;
  sponsored: boolean;
  disclosureNote: string;
  featured: boolean;
  features: string[];
  advantages: string[];
  limitations: string[];
  whyRecommend: string;
  bestFor: string[];
  operatingSystems: string[];
  serverLocations: string[];
  platforms: string[];
  cpu: string;
  ram: string;
  storage: string;
  otherSpecs: string;
  price: string;
  priceCurrency: string;
  pricePeriod: string;
  freeTrial: boolean;
  trialNote: string;
  latencyInfo: string;
  latencySource: string;
  rating: string;
  ratingNote: string;
  seoTitle: string;
  seoDescription: string;
  infoVerifiedAt: string;
  position: string;
  hasLogo: boolean;
  hasCover: boolean;
  /** Cache-busting versions for the current images' previews. */
  logoVersion?: number;
  coverVersion?: number;
  id?: string;
}

export const EMPTY_VPS: VpsFormValues = {
  name: "", category: "", headline: "", description: "", officialUrl: "", affiliateUrl: "", ctaLabel: "", promoCode: "", offerText: "", offerExpiresAt: "",
  sponsored: false, disclosureNote: "", featured: false, features: [], advantages: [], limitations: [], whyRecommend: "", bestFor: [], operatingSystems: [],
  serverLocations: [], platforms: [], cpu: "", ram: "", storage: "", otherSpecs: "", price: "", priceCurrency: "", pricePeriod: "", freeTrial: false,
  trialNote: "", latencyInfo: "", latencySource: "", rating: "", ratingNote: "", seoTitle: "", seoDescription: "", infoVerifiedAt: "", position: "",
  hasLogo: false, hasCover: false,
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
        <span className="text-xs font-medium text-slate-600">Other {legend.toLowerCase()} (comma-separated)</span>
        <input id={`${name}Custom`} name={`${name}Custom`} defaultValue={custom} className={inputCls} maxLength={200} />
      </label>
    </div>
  );
}

function ImageField({ kind, label, hint, id, has, version }: { kind: "logo" | "cover"; label: string; hint: string; id?: string; has: boolean; version?: number }) {
  return (
    <div className="grid gap-2">
      <label className={labelCls} htmlFor={kind}>
        {label} <span className={hintCls}>{hint}</span>
      </label>
      <input id={kind} name={kind} type="file" accept="image/png,image/jpeg,image/webp" className="text-sm" />
      {has && id && (
        <div className="flex flex-wrap items-center gap-3">
          {/* A plain <img>: a tiny admin-only preview of the current stored image. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`/api/vps/${id}/${kind}${version ? `?v=${version}` : ""}`} alt={`Current ${kind}`} className={kind === "logo" ? "h-12 w-12 rounded border border-slate-200 object-contain" : "h-16 w-48 rounded border border-slate-200 object-cover"} />
          <label className="flex items-center gap-2 text-xs text-slate-600">
            <input type="checkbox" name={kind === "logo" ? "removeLogo" : "removeCover"} className="h-4 w-4 rounded border-slate-300" /> Remove the current {kind === "logo" ? "logo" : "cover photo"} (uploading a new file replaces it anyway)
          </label>
        </div>
      )}
    </div>
  );
}

interface Props {
  /** Present when editing; absent when creating. */
  providerId?: string;
  initial?: VpsFormValues;
}

export function VpsForm({ providerId, initial = EMPTY_VPS }: Props) {
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
        startTransition(async () => {
          // Downscale and re-encode the images in the browser first (the server only enforces the caps).
          try {
            for (const kind of ["logo", "cover"] as const) {
              const file = form.get(kind);
              if (file instanceof File && file.size > 0) form.set(kind, await optimizeForUpload(file, kind));
            }
          } catch (err) {
            return setError(err instanceof Error ? err.message : "That image couldn't be processed.");
          }
          const result = await saveVpsAction(providerId ?? null, form);
          if (!result.ok) return setError(result.error);
          if (!providerId) return router.push(`/admin/vps/${result.id}?created=1`);
          setSaved(true);
          router.refresh();
        });
      }}
    >
      <Section title="Basic information">
        <label className={labelCls}>
          Provider name
          <input id="name" name="name" defaultValue={initial.name} required minLength={2} maxLength={LIMITS.name} className={inputCls} />
        </label>
        <label className={labelCls}>
          Short description <span className={hintCls}>One line shown under the name.</span>
          <input id="headline" name="headline" defaultValue={initial.headline} maxLength={LIMITS.headline} className={inputCls} />
        </label>
        <label className={labelCls}>
          Full description <span className={hintCls}>Shown on the provider&apos;s profile page. Plain text; separate paragraphs with a blank line.</span>
          <textarea id="description" name="description" defaultValue={initial.description} rows={5} maxLength={LIMITS.description} className={areaCls} />
        </label>
        <label className={labelCls}>
          Provider category <span className={hintCls}>Optional, for example “Forex-specialist VPS”.</span>
          <input id="category" name="category" defaultValue={initial.category} maxLength={LIMITS.category} className={inputCls} />
        </label>
        <ImageField kind="logo" label="Provider logo" hint={`PNG, JPG or WebP; compressed in your browser to fit ${Math.round(MAX_VPS_LOGO_BYTES / 1024)} KB.`} id={initial.id} has={initial.hasLogo} version={initial.logoVersion} />
        <ImageField kind="cover" label="Cover photo / banner" hint={`Wide images (about 16:5) work best; compressed to fit ${Math.round(MAX_VPS_COVER_BYTES / 1024)} KB.`} id={initial.id} has={initial.hasCover} version={initial.coverVersion} />
        <label className="flex items-start gap-2 text-sm text-slate-700">
          <input type="checkbox" name="featured" defaultChecked={initial.featured} className="mt-0.5 h-4 w-4 rounded border-slate-300" />
          <span>Mark as Top Pick <span className={hintCls}>(shows a “Top Pick” label — only when you tick this, never automatically)</span></span>
        </label>
        <label className="flex items-start gap-2 text-sm text-slate-700">
          <input type="checkbox" name="sponsored" defaultChecked={initial.sponsored} className="mt-0.5 h-4 w-4 rounded border-slate-300" />
          <span>This is a sponsored / paid placement <span className={hintCls}>(adds a label to the listing)</span></span>
        </label>
        <label className={labelCls}>
          Disclosure label <span className={hintCls}>Optional text for the label, for example “Sponsored placement” or “Partner”.</span>
          <input id="disclosureNote" name="disclosureNote" defaultValue={initial.disclosureNote} maxLength={LIMITS.disclosure} className={inputCls} />
        </label>
      </Section>

      <Section title="Hosting features" hint="Only enter what you have verified. Anything left blank is shown to visitors as “Not provided”. If you fill any of these, add the verification date below.">
        <Checks name="operatingSystems" legend="Operating systems" presets={OS_PRESETS} selected={initial.operatingSystems} custom={customOf(initial.operatingSystems, OS_PRESETS)} />
        <label className={labelCls}>
          Server locations <span className={hintCls}>Comma- or line-separated, for example London, New York, Frankfurt.</span>
          <textarea id="serverLocations" name="serverLocations" defaultValue={initial.serverLocations.join(", ")} rows={2} className={areaCls} />
        </label>
        <Checks name="platforms" legend="Supported trading platforms" presets={PLATFORM_PRESETS} selected={initial.platforms} custom={customOf(initial.platforms, PLATFORM_PRESETS)} />
        <div className="grid gap-4 sm:grid-cols-3">
          <label className={labelCls}>
            CPU
            <input id="cpu" name="cpu" defaultValue={initial.cpu} maxLength={LIMITS.spec} placeholder="e.g. 2 vCPU" className={inputCls} />
          </label>
          <label className={labelCls}>
            RAM
            <input id="ram" name="ram" defaultValue={initial.ram} maxLength={LIMITS.spec} placeholder="e.g. 4 GB" className={inputCls} />
          </label>
          <label className={labelCls}>
            Storage
            <input id="storage" name="storage" defaultValue={initial.storage} maxLength={LIMITS.spec} placeholder="e.g. 60 GB SSD" className={inputCls} />
          </label>
        </div>
        <label className={labelCls}>
          Other specifications
          <textarea id="otherSpecs" name="otherSpecs" defaultValue={initial.otherSpecs} rows={2} maxLength={LIMITS.longSpec} className={areaCls} />
        </label>
        <div className="grid gap-4 sm:grid-cols-3">
          <label className={labelCls}>
            Starting price
            <input id="price" name="price" inputMode="decimal" defaultValue={initial.price} placeholder="e.g. 9.99" className={inputCls} />
          </label>
          <label className={labelCls}>
            Currency
            <input id="priceCurrency" name="priceCurrency" defaultValue={initial.priceCurrency} maxLength={3} placeholder="USD" className={inputCls} />
          </label>
          <label className={labelCls}>
            Billing period
            <select id="pricePeriod" name="pricePeriod" defaultValue={initial.pricePeriod} className={inputCls}>
              <option value="">—</option>
              <option value="MONTH">Per month</option>
              <option value="YEAR">Per year</option>
            </select>
          </label>
        </div>
        <label className="flex items-start gap-2 text-sm text-slate-700">
          <input type="checkbox" name="freeTrial" defaultChecked={initial.freeTrial} className="mt-0.5 h-4 w-4 rounded border-slate-300" />
          <span>Offers a verified free trial <span className={hintCls}>(used by the “Verified free trial” filter)</span></span>
        </label>
        <label className={labelCls}>
          Trial or money-back offer
          <input id="trialNote" name="trialNote" defaultValue={initial.trialNote} maxLength={LIMITS.trial} placeholder="e.g. 7-day money-back guarantee" className={inputCls} />
        </label>
        <label className={labelCls}>
          Verified latency information <span className={hintCls}>Only where you have evidence; it is shown together with its source.</span>
          <textarea id="latencyInfo" name="latencyInfo" defaultValue={initial.latencyInfo} rows={2} maxLength={LIMITS.longSpec} className={areaCls} />
        </label>
        <label className={labelCls}>
          Latency source <span className={hintCls}>Required if you enter latency: where the figure comes from (a test you ran, or a page the provider published).</span>
          <input id="latencySource" name="latencySource" defaultValue={initial.latencySource} maxLength={LIMITS.latencySource} className={inputCls} />
        </label>
        <Checks name="bestFor" legend="Recommended use cases" presets={BEST_FOR_PRESETS} selected={initial.bestFor} custom={customOf(initial.bestFor, BEST_FOR_PRESETS)} />
        <label className={labelCls}>
          Main features <span className={hintCls}>One per line, up to {LIMITS.features}.</span>
          <textarea id="features" name="features" defaultValue={initial.features.join("\n")} rows={5} className={areaCls} />
        </label>
        <label className={labelCls}>
          Information verified on
          <input id="infoVerifiedAt" name="infoVerifiedAt" type="date" defaultValue={initial.infoVerifiedAt} className={`${inputCls} max-w-[12rem]`} />
        </label>
      </Section>

      <Section title="Links and promotions" hint="Only https:// addresses are accepted. The affiliate link, when set, becomes the main button and is labelled as an affiliate link on the page.">
        <label className={labelCls}>
          Official website
          <input id="officialUrl" name="officialUrl" type="url" inputMode="url" defaultValue={initial.officialUrl} required maxLength={LIMITS.longSpec + 100} placeholder="https://www.provider.com" className={inputCls} />
        </label>
        <label className={labelCls}>
          Affiliate / referral link <span className={hintCls}>Optional — your approved sign-up link.</span>
          <input id="affiliateUrl" name="affiliateUrl" type="url" inputMode="url" defaultValue={initial.affiliateUrl} maxLength={500} placeholder="https://…" className={inputCls} />
        </label>
        <label className={labelCls}>
          Button text
          <select id="ctaLabel" name="ctaLabel" defaultValue={initial.ctaLabel} className={inputCls}>
            <option value="">Default (“Get VPS” for affiliate links, otherwise “Visit Provider”)</option>
            {CTA_LABELS.map((l) => <option key={l} value={l}>{l}</option>)}
          </select>
        </label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className={labelCls}>
            Promotional code <span className={hintCls}>Optional.</span>
            <input id="promoCode" name="promoCode" defaultValue={initial.promoCode} maxLength={LIMITS.promo} className={inputCls} />
          </label>
          <label className={labelCls}>
            Offer expires on <span className={hintCls}>Optional. The offer disappears after this day.</span>
            <input id="offerExpiresAt" name="offerExpiresAt" type="date" defaultValue={initial.offerExpiresAt} className={inputCls} />
          </label>
        </div>
        <label className={labelCls}>
          Offer description
          <input id="offerText" name="offerText" defaultValue={initial.offerText} maxLength={LIMITS.offer} placeholder="e.g. 20% off the first three months" className={inputCls} />
        </label>
      </Section>

      <Section title="Editorial and ranking" hint="A rating is an editorial score from 0.0 to 5.0 on the scale explained on the public page; leave it blank to show “Not rated”.">
        <label className={labelCls}>
          Why we recommend this provider <span className={hintCls}>Shown on the card and profile. Plain text; no profit or performance guarantees.</span>
          <textarea id="whyRecommend" name="whyRecommend" defaultValue={initial.whyRecommend} rows={4} maxLength={LIMITS.why} className={areaCls} />
        </label>
        <label className={labelCls}>
          Key advantages <span className={hintCls}>One per line.</span>
          <textarea id="advantages" name="advantages" defaultValue={initial.advantages.join("\n")} rows={3} className={areaCls} />
        </label>
        <label className={labelCls}>
          Limitations or considerations <span className={hintCls}>One per line.</span>
          <textarea id="limitations" name="limitations" defaultValue={initial.limitations.join("\n")} rows={3} className={areaCls} />
        </label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className={labelCls}>
            Rating (0–5)
            <input id="rating" name="rating" type="number" min={0} max={5} step={0.1} defaultValue={initial.rating} className={inputCls} />
          </label>
          <label className={labelCls}>
            Ranking position <span className={hintCls}>Place among published providers (1 = top). Blank keeps the current place.</span>
            <input id="position" name="position" type="number" min={1} max={500} step={1} defaultValue={initial.position} className={inputCls} />
          </label>
        </div>
        <label className={labelCls}>
          Rating methodology note <span className={hintCls}>Optional — what the rating is based on.</span>
          <input id="ratingNote" name="ratingNote" defaultValue={initial.ratingNote} maxLength={LIMITS.ratingNote} className={inputCls} />
        </label>
      </Section>

      <Section title="SEO for the provider profile" hint="Optional. Leave blank to use a title and description generated from the listing.">
        <label className={labelCls}>
          SEO title
          <input id="seoTitle" name="seoTitle" defaultValue={initial.seoTitle} maxLength={LIMITS.seoTitle} className={inputCls} />
        </label>
        <label className={labelCls}>
          SEO meta description
          <textarea id="seoDescription" name="seoDescription" defaultValue={initial.seoDescription} rows={2} maxLength={LIMITS.seoDescription} className={areaCls} />
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
          {pending ? "Saving…" : providerId ? "Save provider" : "Create provider"}
        </button>
      </div>
    </form>
  );
}
