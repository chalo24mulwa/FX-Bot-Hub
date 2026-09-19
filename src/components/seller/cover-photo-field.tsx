"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { uploadAndSetCover } from "@/features/seller/upload-client";
import { getPublicUrl } from "@/lib/storage/public-url";
import { UPLOAD_LIMITS } from "@/lib/storage/validate-upload";

// Client-side pre-check only, to fail fast before a presign round trip — the
// authoritative check is still validateUpload() inside the presign route.
export function validateCoverFile(file: File): string | null {
  const { contentTypes, maxBytes } = UPLOAD_LIMITS.image;
  if (!(contentTypes as readonly string[]).includes(file.type)) return "Cover photo must be a PNG, JPG, or WebP image.";
  if (file.size > maxBytes) return `Cover photo must be under ${Math.round(maxBytes / (1024 * 1024))} MB.`;
  return null;
}

// Owns the blob: preview URL for a just-chosen file. The URL is created in
// the choose handler (not an effect) and revoked when replaced or on unmount,
// so no state is set from inside an effect and nothing leaks.
export function useCoverPreview() {
  const [chosen, setChosen] = useState<{ file: File; url: string } | null>(null);
  const urlRef = useRef<string | null>(null);

  const choose = useCallback((file: File) => {
    if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    const url = URL.createObjectURL(file);
    urlRef.current = url;
    setChosen({ file, url });
  }, []);

  const clear = useCallback(() => {
    if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    urlRef.current = null;
    setChosen(null);
  }, []);

  useEffect(
    () => () => {
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    },
    []
  );

  return { file: chosen?.file ?? null, url: chosen?.url ?? null, choose, clear };
}

interface CoverPhotoPickerProps {
  /** blob: preview of a file the user just chose but hasn't been saved yet. */
  previewUrl: string | null;
  /** Public URL of the cover already saved on the product, if any. */
  savedKey?: string | null;
  onFileChange: (file: File) => void;
  busy?: boolean;
  error?: string | null;
  /** Shown under the preview, e.g. upload status. */
  note?: string | null;
}

// The shared "cover photo" control: a 16:10 preview box (the same aspect
// ratio product cards crop the cover to — see ProductCard) plus a file
// picker. Purely presentational — where the file goes is up to the caller
// (the wizard holds it until the draft exists; the edit page uploads at once).
export function CoverPhotoPicker({ previewUrl, savedKey, onFileChange, busy, error, note }: CoverPhotoPickerProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [localError, setLocalError] = useState<string | null>(null);

  const shownSrc = previewUrl ?? (savedKey ? getPublicUrl(savedKey) : null);
  const message = localError ?? error;

  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm font-medium text-slate-700" id="cover-photo-label">
        Cover photo <span className="font-normal text-slate-400">(recommended)</span>
      </span>
      <div className="relative aspect-[16/10] w-full max-w-sm overflow-hidden rounded-lg border border-dashed border-slate-300 bg-slate-50">
        {shownSrc ? (
          // eslint-disable-next-line @next/next/no-img-element -- blob: previews and unoptimized storage URLs
          <img src={shownSrc} alt="Cover photo preview" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center px-4 text-center text-xs text-slate-400">
            No cover photo yet — it appears above the title on your listing.
          </div>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <input
          ref={inputRef}
          id="cover-photo-input"
          type="file"
          accept="image/png,image/jpeg,image/webp"
          aria-labelledby="cover-photo-label"
          className="sr-only"
          disabled={busy}
          onChange={(e) => {
            const chosen = e.target.files?.[0];
            e.target.value = "";
            if (!chosen) return;
            const problem = validateCoverFile(chosen);
            setLocalError(problem);
            if (!problem) onFileChange(chosen);
          }}
        />
        <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => inputRef.current?.click()}>
          {busy ? "Uploading…" : shownSrc ? "Change cover photo" : "Choose cover photo"}
        </Button>
        <span className="text-xs text-slate-500">PNG, JPG, or WebP · up to 8 MB · landscape (16:10) works best</span>
      </div>
      {note && !message && <p className="text-xs text-slate-500">{note}</p>}
      {message && (
        <p role="alert" className="text-sm text-red-600">
          {message}
        </p>
      )}
    </div>
  );
}

// Edit-page variant: uploads (and replaces the saved cover) the moment a
// file is chosen, then refreshes the server-rendered page so the new cover
// shows everywhere on it.
export function CoverPhotoManager({ productId, savedKey }: { productId: string; savedKey: string | null }) {
  const router = useRouter();
  const preview = useCoverPreview();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function handle(chosen: File) {
    preview.choose(chosen);
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      await uploadAndSetCover(productId, chosen, undefined);
      setSaved(true);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not upload the cover photo.");
      preview.clear();
    } finally {
      setBusy(false);
    }
  }

  return (
    <CoverPhotoPicker
      previewUrl={preview.url}
      savedKey={savedKey}
      onFileChange={handle}
      busy={busy}
      error={error}
      note={saved ? "Cover photo saved." : null}
    />
  );
}
