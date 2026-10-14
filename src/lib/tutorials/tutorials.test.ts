import { describe, expect, it } from "vitest";
import { GUIDES, getGuide } from "@/content/guides";
import type { GuideBlock } from "@/content/guides/types";
import {
  TUTORIALS,
  FEATURED_TUTORIAL_SLUG,
  MOVED_FROM_GUIDES,
  adjacentTutorials,
  getTutorial,
  relatedTutorials,
  tutorialCategoriesWithCounts,
} from "@/content/tutorials";
import { DIFFICULTIES, TUTORIAL_CATEGORIES, type Tutorial } from "@/content/tutorials/types";
import { headingId, parseGuideInline } from "@/lib/guides/inline";
import { paginateTutorials, parseTutorialQuery, searchTutorials, tutorialsHref } from "./search";

const base = { q: "", category: "", difficulty: "", sort: "relevance" as const };

describe("tutorial query parsing", () => {
  it("normalises input and drops unknown values", () => {
    expect(parseTutorialQuery({ q: "  install   mt5 ", category: "nope", difficulty: "expert", sort: "random", page: "x" })).toEqual({
      q: "install mt5",
      category: "",
      difficulty: "",
      sort: "relevance",
      page: 1,
    });
    expect(parseTutorialQuery({ category: "mt4", difficulty: "beginner", sort: "newest", page: "2" })).toEqual({
      q: "",
      category: "mt4",
      difficulty: "beginner",
      sort: "newest",
      page: 2,
    });
    expect(parseTutorialQuery({ q: "x".repeat(400) }).q).toHaveLength(100);
    expect(parseTutorialQuery({ q: ["a", "b"] }).q).toBe("a");
  });

  it("builds short URLs that omit defaults", () => {
    expect(tutorialsHref({})).toBe("/tutorials");
    expect(tutorialsHref({ q: "ea", sort: "relevance", page: 1 })).toBe("/tutorials?q=ea");
    expect(tutorialsHref({ category: "mt5", difficulty: "beginner", sort: "newest", page: 2 }, "#results")).toBe(
      "/tutorials?category=mt5&difficulty=beginner&sort=newest&page=2#results",
    );
  });
});

describe("tutorial search", () => {
  it("keeps the curated learning-path order with no query", () => {
    expect(searchTutorials(TUTORIALS, base).map((t) => t.slug)).toEqual(TUTORIALS.map((t) => t.slug));
  });

  it("requires every term and ranks title matches first", () => {
    const results = searchTutorials(TUTORIALS, { ...base, q: "install mt5" });
    expect(results[0].slug).toMatch(/mt5|metatrader-5/);
    expect(searchTutorials(TUTORIALS, { ...base, q: "install zzqqxx" })).toEqual([]);
  });

  it("matches short terms as whole words", () => {
    expect(searchTutorials(TUTORIALS, { ...base, q: "install ea" })[0].slug).toBe("install-ea-mt5");
    expect(searchTutorials(TUTORIALS, { ...base, q: "ea" }).map((t) => t.slug)).not.toContain("install-metatrader-5");
    expect(searchTutorials(TUTORIALS, { ...base, q: "c++ (" })).toEqual([]);
  });

  it("filters by category and difficulty together", () => {
    const r = searchTutorials(TUTORIALS, { ...base, category: "mt4", difficulty: "beginner" });
    expect(r.length).toBeGreaterThan(0);
    expect(r.every((t) => t.category === "mt4" && t.difficulty === "beginner")).toBe(true);
    expect(searchTutorials(TUTORIALS, { ...base, category: "mt4", difficulty: "advanced" })).toEqual([]);
  });

  it("sorts by newest published date when asked", () => {
    const r = searchTutorials(TUTORIALS, { ...base, sort: "newest" });
    for (let i = 1; i < r.length; i++) expect(r[i - 1].published >= r[i].published).toBe(true);
    const withQuery = searchTutorials(TUTORIALS, { ...base, q: "ea", sort: "newest" });
    for (let i = 1; i < withQuery.length; i++) expect(withQuery[i - 1].published >= withQuery[i].published).toBe(true);
  });

  it("paginates and clamps the page", () => {
    expect(paginateTutorials([1, 2, 3, 4, 5], 9, 2)).toEqual({ items: [5], page: 3, totalPages: 3 });
    expect(paginateTutorials([], 1).totalPages).toBe(1);
  });
});

describe("tutorial content integrity", () => {
  const tutorialSlugs = new Set(TUTORIALS.map((t) => t.slug));
  const guideSlugs = new Set(GUIDES.map((g) => g.slug));

  const blockTexts = (b: GuideBlock): string[] => {
    switch (b.type) {
      case "ul":
      case "ol":
        return b.items;
      case "steps":
        return b.items.flatMap((s) => [s.title, s.text]);
      case "table":
        return b.rows.flat();
      default:
        return [b.text];
    }
  };
  const tutorialTexts = (t: Tutorial) => [
    t.intro,
    t.expectedResult,
    ...t.requirements,
    ...t.outcomes,
    ...t.steps.flatMap((s) => [s.title, ...s.text, ...(s.items ?? []), s.note?.text ?? ""]),
    ...t.troubleshooting.flatMap((x) => [x.problem, x.fix]),
    ...(t.reference?.blocks.flatMap(blockTexts) ?? []),
  ];

  function checkLinks(owner: string, texts: string[]) {
    for (const text of texts) {
      for (const node of parseGuideInline(text)) {
        if (node.type !== "link" || node.external) continue;
        const path = node.href.split(/[?#]/)[0];
        if (path.startsWith("/tutorials/")) expect(tutorialSlugs.has(path.slice(11)), `${owner} → ${node.href}`).toBe(true);
        if (path.startsWith("/guides/")) expect(guideSlugs.has(path.slice(8)), `${owner} → ${node.href}`).toBe(true);
      }
    }
  }

  it("publishes 14 tutorials with unique slugs, titles and descriptions", () => {
    expect(TUTORIALS).toHaveLength(14);
    for (const key of ["slug", "title", "seoTitle", "description"] as const) {
      const values = TUTORIALS.map((t) => t[key]);
      expect(new Set(values).size, key).toBe(values.length);
    }
  });

  it("never reuses a guide's title or description (no duplicate pages)", () => {
    const guideTitles = new Set(GUIDES.flatMap((g) => [g.title, g.seoTitle]));
    const guideDescriptions = new Set(GUIDES.map((g) => g.description));
    for (const t of TUTORIALS) {
      expect(guideTitles.has(t.title), t.slug).toBe(false);
      expect(guideTitles.has(t.seoTitle), t.slug).toBe(false);
      expect(guideDescriptions.has(t.description), t.slug).toBe(false);
    }
  });

  it("has valid slugs, categories, difficulties, dates and descriptions", () => {
    const categories = new Set<string>(TUTORIAL_CATEGORIES.map((c) => c.slug));
    const difficulties = new Set<string>(DIFFICULTIES.map((d) => d.slug));
    for (const t of TUTORIALS) {
      expect(t.slug).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
      expect(categories.has(t.category)).toBe(true);
      expect(difficulties.has(t.difficulty)).toBe(true);
      expect(t.published <= t.updated, t.slug).toBe(true);
      expect(t.description.length, t.slug).toBeGreaterThan(70);
      expect(t.description.length, t.slug).toBeLessThanOrEqual(160);
      expect(t.estimatedMinutes).toBeGreaterThan(0);
      expect(t.steps.length, t.slug).toBeGreaterThanOrEqual(3);
      expect(t.requirements.length && t.outcomes.length && t.troubleshooting.length, t.slug).toBeTruthy();
    }
  });

  it("only references tutorials and guides that exist", () => {
    for (const t of TUTORIALS) {
      for (const r of t.related) expect(tutorialSlugs.has(r), `${t.slug} → related ${r}`).toBe(true);
      for (const g of t.guides) expect(guideSlugs.has(g), `${t.slug} → guide ${g}`).toBe(true);
      if (t.next) expect(tutorialSlugs.has(t.next) && t.next !== t.slug, `${t.slug} → next`).toBe(true);
      expect(relatedTutorials(t).some((r) => r.slug === t.slug)).toBe(false);
      checkLinks(t.slug, tutorialTexts(t));
    }
    for (const g of GUIDES) {
      for (const s of g.tutorials) expect(tutorialSlugs.has(s), `${g.slug} → tutorial ${s}`).toBe(true);
      checkLinks(g.slug, [g.intro, ...g.blocks.flatMap(blockTexts)]);
    }
  });

  it("redirects every moved guide to a tutorial, and never to a guide that still exists", () => {
    for (const [from, to] of Object.entries(MOVED_FROM_GUIDES)) {
      expect(getTutorial(to), to).toBeDefined();
      expect(getGuide(from), from).toBeUndefined();
    }
  });

  it("builds unique anchors, prev/next links and non-empty categories", () => {
    for (const t of TUTORIALS) {
      const ids = [...t.steps.map((s) => headingId(s.title)), t.reference ? headingId(t.reference.heading) : ""].filter(Boolean);
      expect(new Set(ids).size, t.slug).toBe(ids.length);
    }
    expect(adjacentTutorials(TUTORIALS[0].slug).previous).toBeUndefined();
    expect(adjacentTutorials(TUTORIALS[0].slug).next?.slug).toBe(TUTORIALS[1].slug);
    expect(adjacentTutorials(TUTORIALS.at(-1)!.slug).next).toBeUndefined();
    expect(tutorialCategoriesWithCounts()).toHaveLength(TUTORIAL_CATEGORIES.length);
    expect(getTutorial(FEATURED_TUTORIAL_SLUG)).toBeDefined();
  });
});
