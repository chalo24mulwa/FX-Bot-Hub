import type { Tutorial } from "@/content/tutorials/types";
import { DIFFICULTIES, TUTORIAL_CATEGORIES } from "@/content/tutorials/types";
import { stripGuideInline } from "@/lib/guides/inline";

/** Pure tutorial search / filter / sort / pagination — unit-tested in tutorials.test.ts. */

export const TUTORIALS_PAGE_SIZE = 9;
export const MAX_TUTORIAL_QUERY_LENGTH = 100;

export type TutorialSort = "relevance" | "newest";

export interface TutorialQuery {
  q: string;
  category: string;
  difficulty: string;
  sort: TutorialSort;
  page: number;
}

type Raw = string | string[] | undefined;

/** Validates raw query-string input: unknown categories/difficulties/sorts are dropped. */
export function parseTutorialQuery(raw: { q?: Raw; category?: Raw; difficulty?: Raw; sort?: Raw; page?: Raw }): TutorialQuery {
  const first = (v: Raw) => (Array.isArray(v) ? v[0] : v) ?? "";
  const q = first(raw.q).replace(/\s+/g, " ").trim().slice(0, MAX_TUTORIAL_QUERY_LENGTH);
  const categoryRaw = first(raw.category);
  const category = TUTORIAL_CATEGORIES.some((c) => c.slug === categoryRaw) ? categoryRaw : "";
  const difficultyRaw = first(raw.difficulty);
  const difficulty = DIFFICULTIES.some((d) => d.slug === difficultyRaw) ? difficultyRaw : "";
  const sort: TutorialSort = first(raw.sort) === "newest" ? "newest" : "relevance";
  const pageNum = Number.parseInt(first(raw.page), 10);
  const page = Number.isFinite(pageNum) && pageNum > 1 ? pageNum : 1;
  return { q, category, difficulty, sort, page };
}

/** Searchable body text: steps, requirements and outcomes (not the troubleshooting tables). */
export function tutorialPlainText(t: Tutorial): string {
  return stripGuideInline(
    [t.intro, ...t.requirements, ...t.outcomes, ...t.steps.flatMap((s) => [s.title, ...s.text, ...(s.items ?? [])])].join(" "),
  );
}

const byNewest = (a: Tutorial, b: Tutorial) =>
  b.published.localeCompare(a.published) || b.updated.localeCompare(a.updated) || a.title.localeCompare(b.title);

/**
 * Filters by category and difficulty, then matches every query term against the title
 * (weight 5), description (3) or steps (1). "relevance" ranks by that score, or — with no
 * query — keeps the curated order of `tutorials`; "newest" sorts by published date.
 */
export function searchTutorials(tutorials: Tutorial[], query: Pick<TutorialQuery, "q" | "category" | "difficulty" | "sort">): Tutorial[] {
  const pool = tutorials.filter(
    (t) => (!query.category || t.category === query.category) && (!query.difficulty || t.difficulty === query.difficulty),
  );
  const terms = query.q.toLowerCase().split(" ").filter(Boolean);
  // Short terms ("ea", "mt4") must be whole words (plural allowed), so "ea" doesn't match
  // inside "each" or "search".
  const matchers = terms.map((term) => {
    if (term.length > 3) return (text: string) => text.includes(term);
    const re = new RegExp(`(^|[^a-z0-9])${term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}s?($|[^a-z0-9])`);
    return (text: string) => re.test(text);
  });
  if (terms.length === 0) return query.sort === "newest" ? [...pool].sort(byNewest) : pool;

  const scored: { t: Tutorial; score: number; order: number }[] = [];
  pool.forEach((t, order) => {
    const title = t.title.toLowerCase();
    const description = t.description.toLowerCase();
    const body = tutorialPlainText(t).toLowerCase();
    let score = 0;
    for (const matches of matchers) {
      if (matches(title)) score += 5;
      else if (matches(description)) score += 3;
      else if (matches(body)) score += 1;
      else return;
    }
    scored.push({ t, score, order });
  });
  if (query.sort === "newest") return scored.map((s) => s.t).sort(byNewest);
  return scored.sort((a, b) => b.score - a.score || a.order - b.order).map((s) => s.t);
}

export function paginateTutorials<T>(items: T[], page: number, pageSize = TUTORIALS_PAGE_SIZE) {
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const current = Math.min(Math.max(1, page), totalPages);
  return { items: items.slice((current - 1) * pageSize, current * pageSize), page: current, totalPages };
}

/** Builds a /tutorials URL from a query, omitting defaults so URLs stay short and canonical. */
export function tutorialsHref(params: Partial<TutorialQuery>, hash = ""): string {
  const sp = new URLSearchParams();
  if (params.q) sp.set("q", params.q);
  if (params.category) sp.set("category", params.category);
  if (params.difficulty) sp.set("difficulty", params.difficulty);
  if (params.sort === "newest") sp.set("sort", "newest");
  if (params.page && params.page > 1) sp.set("page", String(params.page));
  const qs = sp.toString();
  return `/tutorials${qs ? `?${qs}` : ""}${hash}`;
}
