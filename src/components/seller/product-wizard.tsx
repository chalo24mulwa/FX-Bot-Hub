"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  createProductFromDataAction,
  updateProductFromDataAction,
  submitForReviewAction,
} from "@/features/seller/actions";
import {
  uploadAndAttachScreenshot,
  uploadAndAttachDocumentationFile,
  uploadAndAttachProductFile,
} from "@/features/seller/upload-client";

const STEPS = [
  "Product type",
  "Platform",
  "Basic information",
  "Description",
  "Features",
  "Screenshots",
  "Documentation",
  "Files",
  "Pricing",
  "Compatibility",
  "Testing & support",
  "Submit for review",
] as const;

interface WizardData {
  type: string;
  platform: string;
  name: string;
  categoryId: string;
  shortSummary: string;
  description: string;
  features: string[];
  pricingType: string;
  priceCents: number;
  currency: string;
  tags: string[];
  compatibilityNotes: string;
  requirements: string;
  supportInfo: string;
}

const EMPTY: WizardData = {
  type: "EA",
  platform: "MT5",
  name: "",
  categoryId: "",
  shortSummary: "",
  description: "",
  features: [],
  pricingType: "ONE_TIME",
  priceCents: 0,
  currency: "USD",
  tags: [],
  compatibilityNotes: "",
  requirements: "",
  supportInfo: "",
};

export function ProductWizard({ categories }: { categories: { id: string; name: string }[] }) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [data, setData] = useState<WizardData>(EMPTY);
  const [productId, setProductId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [uploaded, setUploaded] = useState<{ screenshots: number; docs: number; files: number }>({
    screenshots: 0,
    docs: 0,
    files: 0,
  });

  function set<K extends keyof WizardData>(key: K, value: WizardData[K]) {
    setData((d) => ({ ...d, [key]: value }));
  }

  async function next() {
    setError(null);

    // Draft is created on leaving step 5 (Features), since steps 6-8 need a
    // productId to attach uploads to.
    if (step === 4 && !productId) {
      setBusy(true);
      try {
        const product = await createProductFromDataAction({
          name: data.name,
          type: data.type as never,
          platform: data.platform as never,
          categoryId: data.categoryId || undefined,
          shortSummary: data.shortSummary,
          description: data.description,
          // The textarea keeps every line (including a blank trailing one
          // from pressing Enter after the last feature) so typing feels
          // natural — trim/filter only here, at submission time, matching
          // formDataToProductInput()'s same treatment for the single-page
          // edit form. An empty string fails the schema's min(1) per
          // feature; sending one straight from a raw split() is what was
          // producing an opaque, production-masked validation error.
          features: data.features.map((f) => f.trim()).filter(Boolean),
          pricingType: "ONE_TIME",
          priceCents: 0,
          currency: "USD",
          tags: data.tags,
        });
        setProductId(product.id);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not save your product.");
        setBusy(false);
        return;
      }
      setBusy(false);
    }

    // Pricing/compatibility/testing steps PATCH the existing draft.
    if (step === 8 && productId) {
      await updateProductFromDataAction(productId, {
        pricingType: data.pricingType as never,
        priceCents: data.pricingType === "FREE" ? 0 : data.priceCents,
        currency: data.currency,
      });
    }
    if (step === 9 && productId) {
      await updateProductFromDataAction(productId, { compatibilityNotes: data.compatibilityNotes });
    }
    if (step === 10 && productId) {
      await updateProductFromDataAction(productId, {
        requirements: data.requirements,
        supportInfo: data.supportInfo,
      });
    }

    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  }

  function back() {
    setStep((s) => Math.max(s - 1, 0));
  }

  async function finish() {
    if (!productId) return;
    setBusy(true);
    setError(null);
    try {
      await submitForReviewAction(productId);
      router.push(`/seller/products/${productId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not submit for review.");
      setBusy(false);
    }
  }

  const canLeaveStep4 = data.name.trim().length >= 3 && data.shortSummary.trim().length >= 10 && data.description.trim().length >= 20;

  return (
    <div>
      <ol className="mb-6 flex flex-wrap gap-1 text-xs">
        {STEPS.map((label, i) => (
          <li
            key={label}
            className={`rounded-full px-2 py-1 ${
              i === step ? "bg-slate-900 text-white" : i < step ? "bg-slate-200 text-slate-600" : "bg-slate-100 text-slate-400"
            }`}
          >
            {i + 1}. {label}
          </li>
        ))}
      </ol>

      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

      <div className="max-w-xl">
        {step === 0 && (
          <StepChoice
            label="What are you listing?"
            value={data.type}
            onChange={(v) => set("type", v)}
            options={[
              ["EA", "Expert Advisor"],
              ["INDICATOR", "Indicator"],
              ["SIGNAL", "Signal"],
              ["TOOL", "Tool"],
              ["OTHER", "Other"],
            ]}
          />
        )}

        {step === 1 && (
          <StepChoice
            label="Which platform?"
            value={data.platform}
            onChange={(v) => set("platform", v)}
            options={[
              ["MT4", "MT4"],
              ["MT5", "MT5"],
              ["MULTI_PLATFORM", "MT4 + MT5"],
            ]}
          />
        )}

        {step === 2 && (
          <div className="flex flex-col gap-4">
            <label className="flex flex-col gap-1 text-sm">
              Product name
              <Input value={data.name} onChange={(e) => set("name", e.target.value)} minLength={3} maxLength={120} />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              Category
              <select
                value={data.categoryId}
                onChange={(e) => set("categoryId", e.target.value)}
                className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm"
              >
                <option value="">Uncategorized</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-sm">
              Short summary
              <Input
                value={data.shortSummary}
                onChange={(e) => set("shortSummary", e.target.value)}
                minLength={10}
                maxLength={200}
              />
            </label>
          </div>
        )}

        {step === 3 && (
          <label className="flex flex-col gap-1 text-sm">
            Description
            <textarea
              value={data.description}
              onChange={(e) => set("description", e.target.value)}
              rows={8}
              className="rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
          </label>
        )}

        {step === 4 && (
          <label className="flex flex-col gap-1 text-sm">
            Features (one per line)
            <textarea
              value={data.features.join("\n")}
              onChange={(e) => set("features", e.target.value.split("\n"))}
              rows={6}
              className="rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
          </label>
        )}

        {step === 5 && productId && (
          <UploadStep
            label="Add a few screenshots (optional)"
            accept="image/*"
            count={uploaded.screenshots}
            onUpload={async (file) => {
              await uploadAndAttachScreenshot(productId, file);
              setUploaded((u) => ({ ...u, screenshots: u.screenshots + 1 }));
            }}
          />
        )}

        {step === 6 && productId && (
          <UploadStep
            label="Add documentation (optional — PDF, Markdown, or text)"
            accept=".pdf,.md,.txt"
            count={uploaded.docs}
            needsTitle
            onUpload={async (file, title) => {
              await uploadAndAttachDocumentationFile(productId, file, title ?? file.name);
              setUploaded((u) => ({ ...u, docs: u.docs + 1 }));
            }}
          />
        )}

        {step === 7 && productId && (
          <FileUploadStep
            productId={productId}
            defaultPlatform={data.platform}
            count={uploaded.files}
            onUploaded={() => setUploaded((u) => ({ ...u, files: u.files + 1 }))}
          />
        )}

        {step === 8 && (
          <div className="flex flex-col gap-4">
            <StepChoice
              label="Pricing model"
              value={data.pricingType}
              onChange={(v) => set("pricingType", v)}
              options={[
                ["FREE", "Free"],
                ["ONE_TIME", "One-time purchase"],
                ["SUBSCRIPTION", "Subscription"],
              ]}
            />
            {data.pricingType !== "FREE" && (
              <label className="flex flex-col gap-1 text-sm">
                Price (cents)
                <Input
                  type="number"
                  min={0}
                  value={data.priceCents}
                  onChange={(e) => set("priceCents", Number(e.target.value))}
                />
              </label>
            )}
          </div>
        )}

        {step === 9 && (
          <label className="flex flex-col gap-1 text-sm">
            Compatibility notes (brokers, account types, timeframes…)
            <textarea
              value={data.compatibilityNotes}
              onChange={(e) => set("compatibilityNotes", e.target.value)}
              rows={5}
              className="rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
          </label>
        )}

        {step === 10 && (
          <div className="flex flex-col gap-4">
            <label className="flex flex-col gap-1 text-sm">
              Testing information (backtest period, forward-test results…)
              <textarea
                value={data.requirements}
                onChange={(e) => set("requirements", e.target.value)}
                rows={4}
                className="rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              Support information
              <textarea
                value={data.supportInfo}
                onChange={(e) => set("supportInfo", e.target.value)}
                rows={3}
                className="rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
            </label>
          </div>
        )}

        {step === 11 && (
          <div>
            <p className="text-sm text-slate-600">
              Ready to submit <strong>{data.name}</strong> for review. A moderator will approve or reject it —
              you can keep editing everything (including uploads) from the product page afterwards.
            </p>
          </div>
        )}
      </div>

      <div className="mt-8 flex gap-3">
        {step > 0 && (
          <Button type="button" variant="outline" onClick={back} disabled={busy}>
            Back
          </Button>
        )}
        {step < STEPS.length - 1 ? (
          <Button type="button" onClick={next} disabled={busy || (step === 4 && !canLeaveStep4)}>
            {busy ? "Saving…" : "Next"}
          </Button>
        ) : (
          <Button type="button" onClick={finish} disabled={busy || !productId}>
            {busy ? "Submitting…" : "Submit for review"}
          </Button>
        )}
      </div>
    </div>
  );
}

function StepChoice({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: [string, string][];
}) {
  return (
    <div>
      <p className="mb-3 text-sm font-medium text-slate-700">{label}</p>
      <div className="flex flex-wrap gap-2">
        {options.map(([val, text]) => (
          <button
            key={val}
            type="button"
            onClick={() => onChange(val)}
            className={`rounded-md border px-4 py-2 text-sm ${
              value === val ? "border-slate-900 bg-slate-900 text-white" : "border-slate-300 hover:bg-slate-50"
            }`}
          >
            {text}
          </button>
        ))}
      </div>
    </div>
  );
}

function UploadStep({
  label,
  accept,
  count,
  needsTitle,
  onUpload,
}: {
  label: string;
  accept: string;
  count: number;
  needsTitle?: boolean;
  onUpload: (file: File, title?: string) => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [title, setTitle] = useState("");

  return (
    <div>
      <p className="mb-3 text-sm font-medium text-slate-700">{label}</p>
      <p className="mb-2 text-xs text-slate-500">{count} uploaded so far</p>
      {needsTitle && (
        <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title" className="mb-2 max-w-xs" />
      )}
      <input
        type="file"
        accept={accept}
        disabled={busy}
        onChange={async (e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          setBusy(true);
          await onUpload(file, title || undefined);
          setBusy(false);
          e.target.value = "";
          setTitle("");
        }}
        className="text-sm"
      />
    </div>
  );
}

function FileUploadStep({
  productId,
  defaultPlatform,
  count,
  onUploaded,
}: {
  productId: string;
  defaultPlatform: string;
  count: number;
  onUploaded: () => void;
}) {
  const [version, setVersion] = useState("1.0.0");
  const [platform, setPlatform] = useState(defaultPlatform === "MULTI_PLATFORM" ? "MT4" : defaultPlatform);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <div>
      <p className="mb-3 text-sm font-medium text-slate-700">Upload your product file(s)</p>
      <p className="mb-2 text-xs text-slate-500">{count} uploaded so far</p>
      {error && <p className="mb-2 text-xs text-red-600">{error}</p>}
      <div className="flex flex-wrap items-center gap-2">
        <Input value={version} onChange={(e) => setVersion(e.target.value)} placeholder="Version" className="w-28" />
        <select
          value={platform}
          onChange={(e) => setPlatform(e.target.value)}
          className="h-10 rounded-md border border-slate-300 bg-white px-2 text-sm"
        >
          <option value="MT4">MT4</option>
          <option value="MT5">MT5</option>
        </select>
        <input
          type="file"
          accept=".ex4,.ex5,.mq4,.mq5,.set,.zip"
          disabled={busy}
          onChange={async (e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            setBusy(true);
            setError(null);
            try {
              await uploadAndAttachProductFile(productId, file, {
                version,
                platform: platform as "MT4" | "MT5",
              });
              onUploaded();
            } catch (err) {
              setError(err instanceof Error ? err.message : "Upload failed.");
            }
            setBusy(false);
            e.target.value = "";
          }}
          className="text-sm"
        />
      </div>
    </div>
  );
}
