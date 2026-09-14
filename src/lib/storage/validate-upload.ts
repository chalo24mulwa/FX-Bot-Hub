export const UPLOAD_LIMITS = {
  productFile: {
    maxBytes: 50 * 1024 * 1024, // 50 MB
    extensions: [".ex4", ".ex5", ".mq4", ".mq5", ".set", ".zip"],
    contentTypes: ["application/octet-stream", "application/zip", "application/x-zip-compressed"],
  },
  image: {
    maxBytes: 8 * 1024 * 1024, // 8 MB
    extensions: [".png", ".jpg", ".jpeg", ".webp"],
    contentTypes: ["image/png", "image/jpeg", "image/webp"],
  },
  documentation: {
    maxBytes: 15 * 1024 * 1024, // 15 MB
    extensions: [".pdf", ".md", ".txt"],
    contentTypes: ["application/pdf", "text/markdown", "text/plain"],
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

/**
 * Extension + MIME + size allowlist check, run before accepting any
 * user-supplied file (never trust the client-reported contentType alone —
 * this is a defense layer, not a substitute for storing files outside the
 * web root / serving them with a safe Content-Disposition).
 */
export function validateUpload({ kind, fileName, contentType, sizeBytes }: ValidateUploadInput): ValidateUploadResult {
  const limits = UPLOAD_LIMITS[kind];

  const ext = fileName.slice(fileName.lastIndexOf(".")).toLowerCase();
  if (!(limits.extensions as readonly string[]).includes(ext)) {
    return { ok: false, error: `File extension "${ext}" is not allowed for ${kind} uploads.` };
  }

  if (!(limits.contentTypes as readonly string[]).includes(contentType)) {
    return { ok: false, error: `Content type "${contentType}" is not allowed for ${kind} uploads.` };
  }

  if (sizeBytes <= 0 || sizeBytes > limits.maxBytes) {
    return { ok: false, error: `File must be between 1 byte and ${limits.maxBytes} bytes.` };
  }

  return { ok: true };
}
