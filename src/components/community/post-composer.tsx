"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Bold, Code, ImagePlus, Italic, Link2, List, Quote, X } from "lucide-react";
import type { CommunityPostType, TradeDirection } from "@prisma/client";
import { LIMITS, POST_TYPES, TIMEFRAMES, isTradePostType } from "@/config/community";
import { cn } from "@/lib/utils";
import { normalizeTags } from "@/lib/community/content";
import { createPostAction, updatePostAction } from "@/features/community/actions";
import { checkImageFile, uploadCommunityImage } from "@/features/community/upload-client";
import { RichText } from "./rich-text";

const COMMON_INSTRUMENTS = ["EUR/USD", "GBP/USD", "USD/JPY", "USD/CHF", "AUD/USD", "USD/CAD", "NZD/USD", "EUR/GBP", "EUR/JPY", "GBP/JPY", "XAU/USD", "XAG/USD", "US30", "NAS100", "SPX500", "BTC/USD"];

export interface ComposerValues {
  type: CommunityPostType;
  categoryId: string;
  title: string;
  content: string;
  instrument: string;
  direction: TradeDirection | "";
  timeframe: string;
  entryPrice: string;
  stopLoss: string;
  takeProfit: string;
  tags: string;
}

const EMPTY: ComposerValues = { type: "DISCUSSION", categoryId: "", title: "", content: "", instrument: "", direction: "", timeframe: "", entryPrice: "", stopLoss: "", takeProfit: "", tags: "" };

interface UploadedImage {
  id: string;
  name: string;
  preview: string;
  status: "uploading" | "done" | "error";
  storageKey?: string;
  error?: string;
}

const field =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500 disabled:bg-slate-50";
const label = "mb-1 block text-sm font-medium text-slate-700";

export function PostComposer({
  categories,
  mode = "create",
  postId,
  initial,
  defaultCategoryId,
  imagesEnabled,
}: {
  categories: { id: string; name: string }[];
  mode?: "create" | "edit";
  postId?: string;
  initial?: Partial<ComposerValues>;
  defaultCategoryId?: string;
  imagesEnabled: boolean;
}) {
  const router = useRouter();
  const [v, setV] = useState<ComposerValues>({ ...EMPTY, categoryId: defaultCategoryId ?? categories[0]?.id ?? "", ...initial });
  const [preview, setPreview] = useState(false);
  const [images, setImages] = useState<UploadedImage[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const textRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const previewUrls = useRef<string[]>([]);

  useEffect(() => {
    const urls = previewUrls.current;
    return () => urls.forEach((u) => URL.revokeObjectURL(u));
  }, []);

  const set = <K extends keyof ComposerValues>(key: K, value: ComposerValues[K]) => setV((s) => ({ ...s, [key]: value }));
  const isTrade = isTradePostType(v.type);
  const tags = normalizeTags(v.tags, LIMITS.MAX_TAGS);
  const uploading = images.some((i) => i.status === "uploading");

  // ---- Markdown toolbar: wraps/prefixes the current selection ----
  function edit(wrapper: { before: string; after?: string; block?: boolean }) {
    const el = textRef.current;
    if (!el) return;
    const { selectionStart: s, selectionEnd: e } = el;
    const selected = v.content.slice(s, e) || (wrapper.block ? "item" : "text");
    const insert = wrapper.block
      ? selected.split("\n").map((l) => `${wrapper.before}${l}`).join("\n")
      : `${wrapper.before}${selected}${wrapper.after ?? wrapper.before}`;
    const next = v.content.slice(0, s) + insert + v.content.slice(e);
    set("content", next);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(s + insert.length, s + insert.length);
    });
  }

  async function addFiles(files: FileList | null) {
    if (!files) return;
    setError(null);
    const room = LIMITS.MAX_IMAGES - images.length;
    for (const file of Array.from(files).slice(0, Math.max(0, room))) {
      const invalid = checkImageFile(file);
      const id = `${file.name}-${file.size}-${Math.random().toString(36).slice(2, 8)}`;
      const preview = URL.createObjectURL(file);
      previewUrls.current.push(preview);
      if (invalid) {
        setImages((list) => [...list, { id, name: file.name, preview, status: "error", error: invalid }]);
        continue;
      }
      setImages((list) => [...list, { id, name: file.name, preview, status: "uploading" }]);
      try {
        const { storageKey } = await uploadCommunityImage(file);
        setImages((list) => list.map((i) => (i.id === id ? { ...i, status: "done", storageKey } : i)));
      } catch (err) {
        setImages((list) => list.map((i) => (i.id === id ? { ...i, status: "error", error: err instanceof Error ? err.message : "Upload failed." } : i)));
      }
    }
    if (fileRef.current) fileRef.current.value = "";
  }

  function submit() {
    setError(null);
    if (uploading) return setError("Wait for your images to finish uploading.");
    const doneKeys = images.filter((i) => i.status === "done" && i.storageKey).map((i) => i.storageKey as string);
    const payload = {
      type: v.type,
      categoryId: v.categoryId,
      title: v.title,
      content: v.content,
      instrument: v.instrument || null,
      direction: v.direction || null,
      timeframe: v.timeframe || null,
      entryPrice: v.entryPrice || null,
      stopLoss: v.stopLoss || null,
      takeProfit: v.takeProfit || null,
      tags,
      ...(mode === "create" ? { images: doneKeys } : {}),
    };
    startTransition(async () => {
      const res = mode === "edit" && postId ? await updatePostAction(postId, payload) : await createPostAction(payload);
      if (res.ok) router.push(`/community/post/${res.id}`);
      else setError(res.error);
    });
  }

  const toolBtn = "rounded-md p-1.5 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900";

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      className="space-y-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_10px_40px_-12px_rgba(2,6,23,0.6)] sm:p-6"
    >
      {mode === "create" && (
        <fieldset>
          <legend className={label}>What are you posting?</legend>
          <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-5">
            {POST_TYPES.map((t) => {
              const disabled = t.value === "CHART" && !imagesEnabled;
              return (
                <label
                  key={t.value}
                  className={cn(
                    "cursor-pointer rounded-xl border p-3 text-sm transition-colors",
                    v.type === t.value ? "border-violet-500 bg-violet-50 ring-1 ring-violet-500" : "border-slate-200 hover:border-slate-300 hover:bg-slate-50",
                    disabled && "cursor-not-allowed opacity-50"
                  )}
                  title={disabled ? "Chart uploads aren't available yet" : undefined}
                >
                  <input type="radio" name="type" value={t.value} checked={v.type === t.value} disabled={disabled} onChange={() => set("type", t.value)} className="sr-only" />
                  <span className="block font-semibold text-slate-900">{t.label}</span>
                  <span className="mt-0.5 block text-xs leading-snug text-slate-500">{t.description}</span>
                </label>
              );
            })}
          </div>
        </fieldset>
      )}

      <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_220px]">
        <div>
          <label htmlFor="post-title" className={label}>
            Title
          </label>
          <input
            id="post-title"
            value={v.title}
            onChange={(e) => set("title", e.target.value)}
            maxLength={LIMITS.TITLE_MAX}
            required
            placeholder={isTrade ? "e.g. EUR/USD — breakout above 1.0900 resistance" : "What do you want to discuss?"}
            className={field}
          />
          <p className="mt-1 text-right text-xs text-slate-400">
            {v.title.length}/{LIMITS.TITLE_MAX}
          </p>
        </div>
        <div>
          <label htmlFor="post-category" className={label}>
            Community
          </label>
          <select id="post-category" value={v.categoryId} onChange={(e) => set("categoryId", e.target.value)} required className={field}>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <div className="mb-1 flex items-center justify-between">
          <label htmlFor="post-content" className="text-sm font-medium text-slate-700">
            {isTrade ? "Analysis" : "Details"}
          </label>
          <div className="flex items-center gap-1" role="toolbar" aria-label="Formatting">
            <button type="button" className={toolBtn} aria-label="Bold" title="Bold" onClick={() => edit({ before: "**" })}>
              <Bold className="h-4 w-4" />
            </button>
            <button type="button" className={toolBtn} aria-label="Italic" title="Italic" onClick={() => edit({ before: "*" })}>
              <Italic className="h-4 w-4" />
            </button>
            <button type="button" className={toolBtn} aria-label="Code" title="Code" onClick={() => edit({ before: "`" })}>
              <Code className="h-4 w-4" />
            </button>
            <button type="button" className={toolBtn} aria-label="Bulleted list" title="List" onClick={() => edit({ before: "- ", block: true })}>
              <List className="h-4 w-4" />
            </button>
            <button type="button" className={toolBtn} aria-label="Quote" title="Quote" onClick={() => edit({ before: "> ", block: true })}>
              <Quote className="h-4 w-4" />
            </button>
            <button type="button" className={toolBtn} aria-label="Link" title="Link" onClick={() => edit({ before: "[", after: "](https://)" })}>
              <Link2 className="h-4 w-4" />
            </button>
            <span className="mx-1 h-4 w-px bg-slate-200" aria-hidden="true" />
            <button type="button" onClick={() => setPreview((p) => !p)} className="rounded-md px-2 py-1 text-xs font-medium text-violet-700 hover:bg-violet-50" aria-pressed={preview}>
              {preview ? "Edit" : "Preview"}
            </button>
          </div>
        </div>
        {preview ? (
          <div className="min-h-[12rem] rounded-lg border border-dashed border-slate-300 bg-slate-50 p-3">
            {v.content.trim() ? <RichText text={v.content} /> : <p className="text-sm text-slate-400">Nothing to preview yet.</p>}
          </div>
        ) : (
          <textarea
            id="post-content"
            ref={textRef}
            value={v.content}
            onChange={(e) => set("content", e.target.value)}
            rows={10}
            maxLength={LIMITS.POST_MAX}
            required
            placeholder="Write your post. You can use **bold**, *italic*, lists, links, @mentions and #tags."
            className={cn(field, "resize-y leading-relaxed")}
          />
        )}
        <p className="mt-1 text-right text-xs text-slate-400">
          {v.content.length.toLocaleString()}/{LIMITS.POST_MAX.toLocaleString()}
        </p>
      </div>

      <fieldset className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
        <legend className="px-1 text-sm font-semibold text-slate-800">
          {isTrade ? "Trade setup" : "Related pair"} <span className="font-normal text-slate-400">— all optional</span>
        </legend>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor="post-instrument" className={label}>
              Instrument / pair
            </label>
            <input id="post-instrument" list="community-instruments" value={v.instrument} onChange={(e) => set("instrument", e.target.value)} maxLength={20} placeholder="EUR/USD" className={field} autoComplete="off" />
            <datalist id="community-instruments">
              {COMMON_INSTRUMENTS.map((i) => (
                <option key={i} value={i} />
              ))}
            </datalist>
          </div>
          {isTrade && (
            <>
              <div>
                <span className={label}>Direction</span>
                <div className="flex gap-2" role="group" aria-label="Direction">
                  {(["BUY", "SELL", "NEUTRAL"] as const).map((d) => (
                    <button
                      key={d}
                      type="button"
                      aria-pressed={v.direction === d}
                      onClick={() => set("direction", v.direction === d ? "" : d)}
                      className={cn(
                        "flex-1 rounded-lg border px-3 py-2 text-sm font-bold transition-colors",
                        v.direction === d
                          ? d === "BUY"
                            ? "border-emerald-500 bg-emerald-500 text-white"
                            : d === "SELL"
                              ? "border-rose-500 bg-rose-500 text-white"
                              : "border-slate-500 bg-slate-500 text-white"
                          : "border-slate-300 bg-white text-slate-600 hover:bg-slate-50"
                      )}
                    >
                      {d}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label htmlFor="post-timeframe" className={label}>
                  Timeframe
                </label>
                <select id="post-timeframe" value={v.timeframe} onChange={(e) => set("timeframe", e.target.value)} className={field}>
                  <option value="">—</option>
                  {TIMEFRAMES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-3 gap-2 sm:col-span-2">
                {(
                  [
                    ["entryPrice", "Entry", "post-entry"],
                    ["stopLoss", "Stop loss", "post-sl"],
                    ["takeProfit", "Take profit", "post-tp"],
                  ] as const
                ).map(([key, text, id]) => (
                  <div key={key}>
                    <label htmlFor={id} className={label}>
                      {text}
                    </label>
                    <input id={id} inputMode="decimal" value={v[key]} onChange={(e) => set(key, e.target.value)} placeholder="1.0850" maxLength={20} className={cn(field, "font-mono")} autoComplete="off" />
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
        {isTrade && <p className="mt-2 text-xs text-slate-500">Leave any of these blank — they&apos;re only shown if you fill them in. This is your own idea, not advice.</p>}
      </fieldset>

      <div>
        <label htmlFor="post-tags" className={label}>
          Tags <span className="font-normal text-slate-400">(up to {LIMITS.MAX_TAGS}, separated by spaces or commas)</span>
        </label>
        <input id="post-tags" value={v.tags} onChange={(e) => set("tags", e.target.value)} placeholder="breakout, london-session, gold" className={field} autoComplete="off" />
        {tags.length > 0 && (
          <ul className="mt-2 flex flex-wrap gap-1.5" aria-label="Tags preview">
            {tags.map((t) => (
              <li key={t} className="rounded-md bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                #{t}
              </li>
            ))}
          </ul>
        )}
      </div>

      {mode === "create" && (
        <div>
          <span className={label}>
            Chart / screenshot <span className="font-normal text-slate-400">(TradingView, MT4, MT5… PNG, JPG or WebP, up to 8 MB, {LIMITS.MAX_IMAGES} images)</span>
          </span>
          {imagesEnabled ? (
            <>
              <input ref={fileRef} id="post-images" type="file" accept="image/png,image/jpeg,image/webp" multiple className="sr-only" onChange={(e) => void addFiles(e.target.files)} disabled={images.length >= LIMITS.MAX_IMAGES} />
              <label
                htmlFor="post-images"
                className={cn(
                  "flex cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-300 px-4 py-6 text-sm font-medium text-slate-600 transition-colors hover:border-violet-400 hover:bg-violet-50",
                  images.length >= LIMITS.MAX_IMAGES && "cursor-not-allowed opacity-50"
                )}
              >
                <ImagePlus className="h-5 w-5" aria-hidden="true" /> Add chart image
              </label>
              {images.length > 0 && (
                <ul className="mt-3 grid gap-3 sm:grid-cols-2">
                  {images.map((img) => (
                    <li key={img.id} className="relative overflow-hidden rounded-xl border border-slate-200">
                      {/* eslint-disable-next-line @next/next/no-img-element -- blob: preview of a local file */}
                      <img src={img.preview} alt={`Preview of ${img.name}`} className="h-36 w-full bg-slate-100 object-cover" />
                      <div className="flex items-center justify-between gap-2 px-3 py-1.5 text-xs">
                        <span className="truncate text-slate-600">{img.name}</span>
                        <span className={img.status === "error" ? "text-red-600" : img.status === "done" ? "text-emerald-600" : "text-slate-500"}>
                          {img.status === "uploading" ? "Uploading…" : img.status === "done" ? "Ready" : (img.error ?? "Failed")}
                        </span>
                      </div>
                      <button type="button" onClick={() => setImages((l) => l.filter((i) => i.id !== img.id))} aria-label={`Remove ${img.name}`} className="absolute right-2 top-2 rounded-full bg-slate-900/70 p-1 text-white hover:bg-slate-900">
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </>
          ) : (
            <p className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-500">Image uploads aren&apos;t available on this site yet — you can still post text.</p>
          )}
        </div>
      )}

      {error && (
        <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
        <p className="max-w-md text-xs text-slate-400">Trading ideas and signals shared by community members are user-generated content and do not constitute financial advice. Trade at your own risk.</p>
        <div className="flex gap-2">
          <button type="button" onClick={() => router.back()} className="rounded-full px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100">
            Cancel
          </button>
          <button
            type="submit"
            disabled={pending || uploading}
            className="rounded-full bg-gradient-to-r from-amber-500 to-orange-500 px-6 py-2 text-sm font-bold text-slate-900 shadow transition hover:from-amber-400 hover:to-orange-400 disabled:opacity-60"
          >
            {pending ? "Posting…" : uploading ? "Uploading…" : mode === "edit" ? "Save changes" : "Publish post"}
          </button>
        </div>
      </div>
    </form>
  );
}
