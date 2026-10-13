import type { Guide, GuideBlock } from "@/content/guides/types";
import { GUIDE_CATEGORIES } from "@/content/guides/types";
import { stripGuideInline } from "./inline";

/** Pure guide search / filter / pagination — unit-tested in guides.test.ts. */

export const GUIDES_PAGE_SIZE = 12;
export const MAX_QUERY_LENGTH = 100;

function blockText(block: GuideBlock): string {
  switch (block.type) {
    case "h2":
    case "h3":
    case "p":
      return block.text;
    case "ul":
    case "ol":
      return block.items.join(" ");
    case "steps":
      return block.items.map((s) => `${s.title} ${s.text}`).join(" ");
    case "callout":
      return `${block.title ?? ""} ${block.text}`;
    case "table":
      return [block.caption, ...block.headers, ...block.rows.flat()].join(" ");
  }
}

export function guidePlainText(guide: Guide): string {
  return stripGuideInline([guide.intro, ...guide.blocks.map(blockText)].join(" "));
}

export function readingMinutes(guide: Guide): number {
  const words = guidePlainText(guide).split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 220));
}

/** Validates raw query-string input: trims, caps length, keeps a known category only. */
export function parseGuideQuery(raw: { q?: string | string[]; category?: string | string[]; page?: string | string[] }) {
  const first = (v?: string | string[]) => (Array.isArray(v) ? v[0] : v) ?? "";
  const q = first(raw.q).replace(/\s+/g, " ").trim().slice(0, MAX_QUERY_LENGTH);
  const categoryRaw = first(raw.category);
  const category = GUIDE_CATEGORIES.some((c) => c.slug === categoryRaw) ? categoryRaw : "";
  const pageNum = Number.parseInt(first(raw.page), 10);
  const page = Number.isFinite(pageNum) && pageNum > 1 ? pageNum : 1;
  return { q, category, page };
}

/**
 * Every query term must appear somewhere (title, description or body). Results rank by
 * where the terms hit: title > description > body. No query = all guides, newest first.
 */
export function searchGuides(guides: Guide[], q: string, category: string): Guide[] {
  const pool = category ? guides.filter((g) => g.category === category) : guides;
  const terms = q.toLowerCase().split(" ").filter((t) => t.length > 0);
  if (terms.length === 0) {
    return [...pool].sort((a, b) => b.published.localeCompare(a.published) || a.title.localeCompare(b.title));
  }

  const scored: { guide: Guide; score: number }[] = [];
  for (const guide of pool) {
    const title = guide.title.toLowerCase();
    const description = guide.description.toLowerCase();
    const body = guidePlainText(guide).toLowerCase();
    let score = 0;
    let all = true;
    for (const term of terms) {
      if (title.includes(term)) score += 5;
      else if (description.includes(term)) score += 3;
      else if (body.includes(term)) score += 1;
      else {
        all = false;
        break;
      }
    }
    if (all) scored.push({ guide, score });
  }
  return scored.sort((a, b) => b.score - a.score || a.guide.title.localeCompare(b.guide.title)).map((s) => s.guide);
}

export function paginate<T>(items: T[], page: number, pageSize = GUIDES_PAGE_SIZE) {
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const current = Math.min(Math.max(1, page), totalPages);
  return { items: items.slice((current - 1) * pageSize, current * pageSize), page: current, totalPages };
}
