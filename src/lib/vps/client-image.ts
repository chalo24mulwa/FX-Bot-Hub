import { fitWithin, MAX_BYTES, type VpsImageKind } from "./images";

// Browser-only. Redraws an uploaded logo/cover on a canvas at a sensible size and re-encodes it as WebP,
// stepping quality (then size) down until it fits the server's cap. Same approach as the Community image
// uploader — no native image library needed on the host. Falls back to the original file when the browser
// can't do it, and reports a clear error when nothing fits.

const MAX_EDGE: Record<VpsImageKind, number> = { logo: 512, cover: 1280 };
const STEPS: Array<{ scale: number; quality: number }> = [
  { scale: 1, quality: 0.86 },
  { scale: 1, quality: 0.72 },
  { scale: 0.8, quality: 0.7 },
  { scale: 0.65, quality: 0.62 },
  { scale: 0.5, quality: 0.55 },
];

export async function optimizeForUpload(file: File, kind: VpsImageKind): Promise<File> {
  const cap = MAX_BYTES[kind];
  const tooBig = `That ${kind === "logo" ? "logo" : "cover photo"} is too large even after compression. Use a smaller image (under ${Math.round(cap / 1024)} KB).`;
  if (typeof createImageBitmap !== "function") {
    if (file.size > cap) throw new Error(tooBig);
    return file;
  }
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    // Not decodable as an image; let the server's check give the real answer.
    if (file.size > cap) throw new Error(tooBig);
    return file;
  }
  try {
    const base = fitWithin(bitmap.width, bitmap.height, MAX_EDGE[kind]);
    let best: Blob | null = null;
    for (const step of STEPS) {
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(base.width * step.scale));
      canvas.height = Math.max(1, Math.round(base.height * step.scale));
      canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/webp", step.quality));
      if (!blob || blob.type !== "image/webp") break;
      best = blob;
      if (blob.size <= cap) break;
    }
    // Keep the original when it is already small and no larger than the re-encoded version.
    if (!best || (file.size <= cap && file.size <= best.size)) {
      if (file.size > cap) throw new Error(tooBig);
      return file;
    }
    if (best.size > cap) throw new Error(tooBig);
    return new File([best], `${file.name.replace(/\.[^.]+$/, "") || kind}.webp`, { type: "image/webp" });
  } finally {
    bitmap.close();
  }
}
