// Broker logos are stored in the database (production has no object storage), so they get the
// strictest treatment: tiny, a raster type only (no SVG — it can carry script), and the type is decided
// by the file's own first bytes, never by the browser-supplied filename or content type.

export const MAX_LOGO_BYTES = 300 * 1024;
export type LogoMime = "image/png" | "image/jpeg" | "image/webp";

export function detectLogoType(bytes: Uint8Array): LogoMime | null {
  if (bytes.length >= 8 && [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((b, i) => bytes[i] === b)) return "image/png";
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (
    bytes.length >= 12 &&
    String.fromCharCode(bytes[0], bytes[1], bytes[2], bytes[3]) === "RIFF" &&
    String.fromCharCode(bytes[8], bytes[9], bytes[10], bytes[11]) === "WEBP"
  ) {
    return "image/webp";
  }
  return null;
}

export type LogoCheck = { ok: true; mime: LogoMime } | { ok: false; error: string };

export function checkLogo(bytes: Uint8Array): LogoCheck {
  if (bytes.length === 0) return { ok: false, error: "That file is empty." };
  if (bytes.length > MAX_LOGO_BYTES) return { ok: false, error: `The logo must be ${Math.round(MAX_LOGO_BYTES / 1024)} KB or smaller.` };
  const mime = detectLogoType(bytes);
  if (!mime) return { ok: false, error: "Upload a PNG, JPG or WebP image (SVG isn't accepted)." };
  return { ok: true, mime };
}
