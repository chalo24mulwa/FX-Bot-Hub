"use client";

import { useCallback, useId, useRef, useState } from "react";
import {
  UPLOAD_LIMITS,
  acceptAttribute,
  describeRejection,
  fileExtension,
  formatGroups,
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
  /** Heading inside the area, e.g. "Drop your product files here". */
  title: string;
  /** Text of the main button. */
  browseLabel?: string;
  /** Visible, human-readable name for the formats (default: the extension list). */
  formatsHint?: string;
  /** Called once each file has uploaded and been saved. */
  onFileDone?: (file: File) => void;
  disabled?: boolean;
  multiple?: boolean;
}

/**
 * The shared "browse or drop files" upload area for the seller screens: one large, labelled target
 * with a prominent Browse button, drag-and-drop, many files at once, a per-file progress bar and a
 * Retry on failures. Files upload one at a time, in the order chosen. The `<input type=file>` is
 * visually hidden but is the real, keyboard-focusable control; the whole area is its label.
 */
export function FileDropzone({
  kind,
  onUpload,
  title,
  browseLabel = "Browse files",
  formatsHint,
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

  const groups = formatGroups(kind);
  const uploading = items.some((i) => i.status === "uploading" || i.status === "queued");

  return (
    <div className="flex flex-col gap-3">
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
        className={`group relative flex cursor-pointer flex-col items-center gap-3 rounded-xl border-2 border-dashed px-4 py-8 text-center transition-colors focus-within:ring-2 focus-within:ring-violet-500 focus-within:ring-offset-2 sm:px-8 ${
          disabled
            ? "cursor-not-allowed border-slate-200 bg-slate-50 opacity-60"
            : dragging
              ? "border-violet-500 bg-violet-50"
              : "border-violet-300 bg-violet-50/50 hover:border-violet-500 hover:bg-violet-50"
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
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-violet-100 text-violet-700" aria-hidden="true">
          <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 16V4" />
            <path d="m7 9 5-5 5 5" />
            <path d="M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3" />
          </svg>
        </span>
        <span className="text-base font-semibold text-slate-900">{title}</span>
        <span className="text-sm text-slate-500">{dragging ? "Release to upload" : "Drag and drop, or"}</span>
        <span className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-violet-600 px-6 text-sm font-semibold text-white shadow-sm transition-colors group-hover:bg-violet-700">
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
          </svg>
          {browseLabel}
        </span>
        <span className="text-xs text-slate-500">
          Up to {formatBytes(limits.maxBytes)} per file{multiple ? " · select as many files as you need" : ""}
        </span>
        <span className="flex max-w-2xl flex-col gap-1.5" aria-label="Accepted formats">
          {formatsHint ? (
            <span className="text-xs text-slate-500">{formatsHint}</span>
          ) : (
            groups.map((group) => (
              <span key={group.label || "all"} className="flex flex-wrap items-center justify-center gap-1">
                {group.label && <span className="mr-1 text-[11px] font-medium text-slate-500">{group.label}</span>}
                {group.extensions.map((ext) => (
                  <span key={ext} className="rounded bg-white px-1.5 py-0.5 font-mono text-[11px] text-slate-600 ring-1 ring-slate-200">
                    {ext}
                  </span>
                ))}
              </span>
            ))
          )}
        </span>
      </label>

      {rejections.length > 0 && (
        <ul role="alert" className="flex flex-col gap-1 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {rejections.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
      )}

      {items.length > 0 && (
        <ul className="flex flex-col gap-2" aria-live="polite" aria-label="Selected files">
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
