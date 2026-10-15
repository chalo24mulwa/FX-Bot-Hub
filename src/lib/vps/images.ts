import { detectLogoType, type LogoMime } from "@/lib/brokers/logo";

// VPS logos and cover banners live in the database, so they're capped and checked strictly: raster only (no
// SVG — it can carry script), the type decided by the file's own first bytes, and small enough that two of
// them fit in one server-action request. The browser downscales and re-encodes before upload
// (`client-image.ts`); this is the server-side backstop that doesn't trust it.

export const MAX_VPS_LOGO_BYTES = 200 * 1024;
export const MAX_VPS_COVER_BYTES = 500 * 1024;
export type VpsImageKind = "logo" | "cover";

export const MAX_BYTES: Record<VpsImageKind, number> = { logo: MAX_VPS_LOGO_BYTES, cover: MAX_VPS_COVER_BYTES };

export type VpsImageCheck = { ok: true; mime: LogoMime } | { ok: false; error: string };

export function checkVpsImage(bytes: Uint8Array, kind: VpsImageKind): VpsImageCheck {
  const label = kind === "logo" ? "logo" : "cover photo";
  if (bytes.length === 0) return { ok: false, error: `The ${label} file is empty.` };
  if (bytes.length > MAX_BYTES[kind]) return { ok: false, error: `The ${label} must be ${Math.round(MAX_BYTES[kind] / 1024)} KB or smaller.` };
  const mime = detectLogoType(bytes);
  if (!mime) return { ok: false, error: `Upload a PNG, JPG or WebP image for the ${label} (SVG isn't accepted).` };
  return { ok: true, mime };
}

/** Fits a width x height box inside `maxEdge` on its longest side, never enlarging. */
export function fitWithin(width: number, height: number, maxEdge: number): { width: number; height: number } {
  if (width <= 0 || height <= 0) return { width: 1, height: 1 };
  const scale = Math.min(1, maxEdge / Math.max(width, height));
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}
