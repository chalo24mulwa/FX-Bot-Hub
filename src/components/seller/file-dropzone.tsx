"use client";

import { useCallback, useId, useRef, useState } from "react";
import {
  UPLOAD_LIMITS,
  acceptAttribute,
  describeRejection,
  fileExtension,
  shownFormats,
  formatBytes,
  type UploadKind,
} from "@/lib/storage/validate-upload";

type ItemStatus = "queued" | "uploading" | "done" | "error";

interface Item {
  id: number;
  file: File;
  status: ItemStatus;
  progress: number;
  error?: string;
}

export interface FileDropzoneProps {
  /** Which allowlist (formats + size) applies — the same one the server enforces. */
  kind: UploadKind;
  /** Uploads one file; throw an Error with a readable message to mark it failed. */
  onUpload: (file: File, onProgress: (fraction: number) => void) => Promise<void>;
  /** Text of the button, which is also the drop target. */
  browseLabel?: string;
  /** Called once each file has uploaded and been saved. */
  onFileDone?: (file: File) => void;
  disabled?: boolean;
  multiple?: boolean;
}

/**
 * The shared upload control for the seller screens: one compact, left-aligned "Browse or drag files here" button that is
 * also the drop target (no wide area), a one-line format hint, many files at once, a per-file progress bar and a
 * Retry on failures. Files upload one at a time, in the order chosen. The `<input type=file>` is
 * visually hidden but is the real, keyboard-focusable control; the whole area is its label.
 */
export function FileDropzone({
  kind,
  onUpload,
  browseLabel = "Browse or drag files here",
  onFileDone,
  disabled = false,
  multiple = true,
}: FileDropzoneProps) {
  const inputId = useId();
  const [items, setItems] = useState<Item[]>([]);
  const [rejections, setRejections] = useState<string[]>([]);
  const [dragging, setDragging] = useState(false);
  const nextId = useRef(1);
  const queue = useRef<Promise<void>>(Promise.resolve());
  const limits = UPLOAD_LIMITS[kind];

  const patch = useCallback((id: number, changes: Partial<Item>) => {
    setItems((all) => all.map((it) => (it.id === id ? { ...it, ...changes } : it)));
  }, []);

  const run = useCallback(
    (item: Item) => {
      queue.current = queue.current.then(async () => {
        patch(item.id, { status: "uploading", progress: 0, error: undefined });
        try {
          await onUpload(item.file, (fraction) => patch(item.id, { progress: Math.max(0, Math.min(1, fraction)) }));
          patch(item.id, { status: "done", progress: 1 });
          onFileDone?.(item.file);
        } catch (err) {
          patch(item.id, { status: "error", error: err instanceof Error ? err.message : "Upload failed. Please try again." });
        }
      });
    },
    [onUpload, onFileDone, patch],
  );

  const addFiles = useCallback(
    (list: FileList | File[]) => {
      const files = Array.from(list);
      const accepted: Item[] = [];
      const problems: string[] = [];
      for (const file of files.slice(0, multiple ? files.length : 1)) {
        const problem = describeRejection({
          kind,
          fileName: file.name,
          contentType: file.type || "application/octet-stream",
          sizeBytes: file.size,
        });
        if (problem) problems.push(problem);
        else accepted.push({ id: nextId.current++, file, status: "queued", progress: 0 });
      }
      setRejections(problems);
      if (accepted.length === 0) return;
      setItems((all) => [...all, ...accepted]);
      accepted.forEach(run);
    },
    [kind, multiple, run],
  );

  const hint = shownFormats(kind);
  const uploading = items.some((i) => i.status === "uploading" || i.status === "queued");

  return (
    <div className="flex flex-col items-start gap-2">
      <label
        htmlFor={inputId}
        onDragOver={(e) => {
          if (disabled) return;
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          if (!disabled && e.dataTransfer.files.length) addFiles(e.dataTransfer.files);
        }}
        data-testid="dropzone"
        className={`inline-flex min-h-12 max-w-full cursor-pointer items-center gap-3 rounded-lg border-2 border-dashed px-5 py-2.5 text-sm font-semibold transition-colors focus-within:ring-2 focus-within:ring-violet-500 focus-within:ring-offset-2 ${
          disabled
            ? "cursor-not-allowed border-slate-200 bg-slate-50 text-slate-400"
            : dragging
              ? "border-violet-600 bg-violet-100 text-violet-800"
              : "border-violet-400 bg-violet-50 text-violet-700 hover:border-violet-600 hover:bg-violet-100"
        }`}
      >
        <input
          id={inputId}
          type="file"
          multiple={multiple}
          accept={acceptAttribute(kind)}
          disabled={disabled}
          className="sr-only"
          onChange={(e) => {
            if (e.target.files?.length) addFiles(e.target.files);
            e.target.value = "";
          }}
        />
        <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M12 16V4" />
          <path d="m7 9 5-5 5 5" />
          <path d="M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3" />
        </svg>
        <span>{dragging ? "Release to upload" : browseLabel}</span>
      </label>
      <p className="text-xs text-slate-500" aria-label="Accepted formats">
        {hint.map((ext) => (
          <span key={ext} className="mr-1.5 font-mono">
            {ext}
          </span>
        ))}
        <span className="text-slate-400">· up to {formatBytes(limits.maxBytes)} each</span>
      </p>

      {rejections.length > 0 && (
        <ul role="alert" className="flex max-w-xl flex-col gap-1 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {rejections.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
      )}

      {items.length > 0 && (
        <ul className="flex w-full max-w-xl flex-col gap-2" aria-live="polite" aria-label="Selected files">
          {items.map((it) => (
            <li key={it.id} className="rounded-lg border border-slate-200 bg-white p-3 text-sm" data-status={it.status}>
              <div className="flex items-center gap-3">
                <span className="flex h-9 w-12 shrink-0 items-center justify-center rounded bg-slate-100 font-mono text-[10px] font-semibold uppercase text-slate-600">
                  {fileExtension(it.file.name).replace(".", "") || "file"}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-slate-900">{it.file.name}</p>
                  <p className="text-xs text-slate-500">
                    {formatBytes(it.file.size)} ·{" "}
                    {it.status === "queued" && "Waiting…"}
                    {it.status === "uploading" && `Uploading ${Math.round(it.progress * 100)}%`}
                    {it.status === "done" && <span className="font-medium text-emerald-700">Uploaded</span>}
                    {it.status === "error" && <span className="font-medium text-red-600">Failed</span>}
                  </p>
                </div>
                {it.status === "error" && (
                  <button
                    type="button"
                    onClick={() => run(it)}
                    className="h-9 shrink-0 rounded-md border border-slate-300 bg-white px-3 text-xs font-medium hover:bg-slate-50"
                  >
                    Retry
                  </button>
                )}
              </div>
              {(it.status === "uploading" || it.status === "queued") && (
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(it.progress * 100)}>
                  <div className="h-full rounded-full bg-violet-600 transition-[width]" style={{ width: `${Math.round(it.progress * 100)}%` }} />
                </div>
              )}
              {it.status === "error" && it.error && (
                <p role="alert" className="mt-2 text-xs text-red-600">
                  {it.error}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
      {uploading && <p className="sr-only">Uploading files, please wait.</p>}
    </div>
  );
}
