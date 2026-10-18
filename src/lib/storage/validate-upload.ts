// Safe to import from Client Components (no env, no server code): the upload areas build their
// "accepted formats" hint and the file-input `accept` list from here, so what the page promises is
// exactly what the server accepts.

/**
 * Everything a seller may attach as a downloadable product file: MetaTrader sources and binaries,
 * templates/presets, archives, Windows installers and helper tools, and plain documents. Delivery is
 * always a signed, time-limited `attachment` download, never an inline page, and a buyer is only
 * ever handed a file after an entitlement check.
 */
export const PRODUCT_FILE_GROUPS = [
  { label: "MetaTrader", extensions: [".ex4", ".ex5", ".mq4", ".mq5", ".mqh", ".mql", ".mql4", ".mql5", ".set", ".tpl", ".chr", ".ini", ".mqproj"] },
  { label: "Archives", extensions: [".zip", ".rar", ".7z", ".tar", ".gz", ".tgz"] },
  { label: "Windows", extensions: [".exe", ".dll", ".msi", ".bat"] },
  { label: "Documents & data", extensions: [".pdf", ".txt", ".md", ".csv", ".json", ".xml", ".doc", ".docx", ".xls", ".xlsx"] },
] as const;

export const PRODUCT_FILE_EXTENSIONS = PRODUCT_FILE_GROUPS.flatMap((g) => g.extensions) as readonly string[];

/**
 * The few formats shown next to an upload button. Everything in the allowlist is still accepted; the screen only names the
 * ones a seller is most likely to be looking for (at most five MetaTrader formats for product files).
 */
export function shownFormats(kind: UploadKind): readonly string[] {
  if (kind === "productFile") return [".ex4", ".ex5", ".mq4", ".mq5", ".set"];
  if (kind === "image") return [".png", ".jpg", ".webp"];
  return [".pdf", ".md", ".txt"];
}

/** One sentence naming what a kind accepts, for the message shown when a file is refused. */
export function supportedSummary(kind: UploadKind): string {
  if (kind === "productFile") return "Upload a MetaTrader file (.ex4, .ex5, .mq4, .mq5, .set), an archive (.zip, .rar, .7z), a Windows program or a document.";
  if (kind === "image") return "Use a PNG, JPG or WebP image.";
  return "Use a PDF, Markdown, text or Word document.";
}

export const UPLOAD_LIMITS = {
  productFile: {
    maxBytes: 50 * 1024 * 1024, // 50 MB
    extensions: PRODUCT_FILE_EXTENSIONS,
    // Browsers disagree about the MIME type of anything MetaTrader-specific (.ex4, .set, .mq5 are often
    // reported as "" or as a Windows-registered type), so the content type is not an allowlist here:
    // the extension and size decide, and the type only has to be a well-formed value (see below).
    contentTypes: null,
  },
  image: {
    maxBytes: 8 * 1024 * 1024, // 8 MB
    extensions: [".png", ".jpg", ".jpeg", ".webp"],
    contentTypes: ["image/png", "image/jpeg", "image/webp"],
  },
  documentation: {
    maxBytes: 15 * 1024 * 1024, // 15 MB
    extensions: [".pdf", ".md", ".txt", ".doc", ".docx", ".rtf", ".csv"],
    contentTypes: null,
  },
} as const;

export type UploadKind = keyof typeof UPLOAD_LIMITS;

export interface ValidateUploadInput {
  kind: UploadKind;
  fileName: string;
  contentType: string;
  sizeBytes: number;
}

export interface ValidateUploadResult {
  ok: boolean;
  error?: string;
}

const MIME_SHAPE = /^[a-z0-9][a-z0-9!#$&^_.+-]*\/[a-z0-9][a-z0-9!#$&^_.+-]*$/i;

export function fileExtension(fileName: string): string {
  const dot = fileName.lastIndexOf(".");
  return dot < 0 ? "" : fileName.slice(dot).toLowerCase();
}

/** "1.5 MB" / "300 KB" — for the limits shown next to the upload areas. */
export function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${Math.round((bytes / (1024 * 1024)) * 10) / 10} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

/** The comma-separated list for an `<input type="file" accept>`. */
export function acceptAttribute(kind: UploadKind): string {
  return UPLOAD_LIMITS[kind].extensions.join(",");
}

/** Plain-English check run in the browser before a presign round trip; the server repeats it. */
export function describeRejection({ kind, fileName, contentType, sizeBytes }: ValidateUploadInput): string | null {
  const limits = UPLOAD_LIMITS[kind];
  const ext = fileExtension(fileName);
  if (!(limits.extensions as readonly string[]).includes(ext)) {
    const shown = ext || "(no extension)";
    return `"${fileName}": ${shown} files can't be uploaded here. ${supportedSummary(kind)}`;
  }
  if (limits.contentTypes && !(limits.contentTypes as readonly string[]).includes(contentType)) {
    return `"${fileName}" is not a supported ${kind === "image" ? "image (use PNG, JPG or WebP)" : "file"} type.`;
  }
  if (!limits.contentTypes && !MIME_SHAPE.test(contentType)) {
    return `"${fileName}" has an invalid content type.`;
  }
  if (sizeBytes <= 0) return `"${fileName}" is empty.`;
  if (sizeBytes > limits.maxBytes) return `"${fileName}" is ${formatBytes(sizeBytes)}; the limit is ${formatBytes(limits.maxBytes)}.`;
  return null;
}

/**
 * Extension + size (+ MIME for images) allowlist check, run before accepting any user-supplied file
 * (never trust the client-reported contentType alone — this is a defense layer, not a substitute for
 * storing files outside the web root / serving them with a safe Content-Disposition).
 */
export function validateUpload(input: ValidateUploadInput): ValidateUploadResult {
  const error = describeRejection(input);
  return error ? { ok: false, error } : { ok: true };
}
