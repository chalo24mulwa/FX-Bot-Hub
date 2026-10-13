/**
 * Tiny inline markup for guide content: **bold**, `code`, [label](href).
 * Links may be internal ("/path", "#anchor") or absolute http(s); anything else stays text.
 * Pure — unit-tested in guides.test.ts — and turned into React elements by GuideInline.
 */

export type GuideInline =
  | { type: "text"; value: string }
  | { type: "bold"; value: string }
  | { type: "code"; value: string }
  | { type: "link"; label: string; href: string; external: boolean };

const PATTERN = /`([^`]+)`|\*\*([^*]+)\*\*|\[([^\]]+)\]\(([^)\s]+)\)/g;

export function safeGuideHref(raw: string): { href: string; external: boolean } | null {
  if (raw.startsWith("/") && !raw.startsWith("//")) return { href: raw, external: false };
  if (raw.startsWith("#")) return { href: raw, external: false };
  try {
    const url = new URL(raw);
    if (url.protocol === "https:" || url.protocol === "http:") return { href: url.toString(), external: true };
  } catch {
    /* not a URL */
  }
  return null;
}

export function parseGuideInline(text: string): GuideInline[] {
  const out: GuideInline[] = [];
  let last = 0;
  for (const m of text.matchAll(PATTERN)) {
    const index = m.index ?? 0;
    if (index > last) out.push({ type: "text", value: text.slice(last, index) });
    if (m[1] !== undefined) out.push({ type: "code", value: m[1] });
    else if (m[2] !== undefined) out.push({ type: "bold", value: m[2] });
    else {
      const link = safeGuideHref(m[4]);
      out.push(link ? { type: "link", label: m[3], ...link } : { type: "text", value: m[0] });
    }
    last = index + m[0].length;
  }
  if (last < text.length) out.push({ type: "text", value: text.slice(last) });
  return out;
}

/** Visible text with markup removed — used for search and word counts. */
export function stripGuideInline(text: string): string {
  return parseGuideInline(text)
    .map((n) => (n.type === "link" ? n.label : n.value))
    .join("");
}

/** Stable heading id for anchors / table of contents. */
export function headingId(text: string): string {
  return stripGuideInline(text)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}
