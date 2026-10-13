import { describe, expect, it } from "vitest";
import { GUIDES, getGuide, relatedGuides, categoriesWithGuides } from "@/content/guides";
import { GUIDE_CATEGORIES, type GuideBlock } from "@/content/guides/types";
import { parseGuideInline, safeGuideHref, headingId, stripGuideInline } from "./inline";
import { paginate, parseGuideQuery, searchGuides } from "./search";

describe("parseGuideInline", () => {
  it("parses bold, code and links", () => {
    expect(parseGuideInline("Use **Refresh** in `MQL4` and [read this](/guides/x).")).toEqual([
      { type: "text", value: "Use " },
      { type: "bold", value: "Refresh" },
      { type: "text", value: " in " },
      { type: "code", value: "MQL4" },
      { type: "text", value: " and " },
      { type: "link", label: "read this", href: "/guides/x", external: false },
      { type: "text", value: "." },
    ]);
  });

  it("never links unsafe or protocol-relative hrefs", () => {
    expect(safeGuideHref("javascript:alert(1)")).toBeNull();
    expect(safeGuideHref("//evil.example")).toBeNull();
    expect(parseGuideInline("[x](javascript:alert(1))")[0].type).toBe("text");
    expect(safeGuideHref("https://docs.mql4.com/")).toEqual({ href: "https://docs.mql4.com/", external: true });
  });

  it("strips markup and builds stable heading ids", () => {
    expect(stripGuideInline("**Bold** and [link](/a)")).toBe("Bold and link");
    expect(headingId("1. Read the documentation")).toBe("1-read-the-documentation");
  });
});

describe("guide search", () => {
  it("validates query input", () => {
    expect(parseGuideQuery({ q: "  mt5   install ", category: "nope", page: "abc" })).toEqual({ q: "mt5 install", category: "", page: 1 });
    expect(parseGuideQuery({ q: "x".repeat(500), category: "mt4", page: "3" })).toMatchObject({ category: "mt4", page: 3 });
    expect(parseGuideQuery({ q: "x".repeat(500) }).q).toHaveLength(100);
  });

  it("requires every term and ranks title matches first", () => {
    const results = searchGuides(GUIDES, "install mt5", "");
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].title).toMatch(/MetaTrader 5|MT5/);
    expect(searchGuides(GUIDES, "install zzqqxx", "")).toEqual([]);
  });

  it("searches article body text, not just titles", () => {
    expect(searchGuides(GUIDES, "pipette", "").map((g) => g.slug)).toContain("forex-trading-for-beginners");
  });

  it("filters by category", () => {
    expect(searchGuides(GUIDES, "", "mt4").every((g) => g.category === "mt4")).toBe(true);
  });

  it("paginates and clamps the page", () => {
    const p = paginate([1, 2, 3, 4, 5], 9, 2);
    expect(p).toEqual({ items: [5], page: 3, totalPages: 3 });
  });
});

describe("guide content integrity", () => {
  const slugs = new Set(GUIDES.map((g) => g.slug));
  const categorySlugs = new Set<string>(GUIDE_CATEGORIES.map((c) => c.slug));

  const textsOf = (block: GuideBlock): string[] => {
    switch (block.type) {
      case "ul":
      case "ol":
        return block.items;
      case "steps":
        return block.items.flatMap((s) => [s.title, s.text]);
      case "table":
        return block.rows.flat();
      case "callout":
        return [block.text];
      default:
        return [block.text];
    }
  };

  it("has unique slugs, titles, SEO titles and descriptions", () => {
    for (const key of ["slug", "title", "seoTitle", "description"] as const) {
      const values = GUIDES.map((g) => g[key]);
      expect(new Set(values).size, key).toBe(values.length);
    }
  });

  it("uses URL-safe slugs, known categories and valid dates", () => {
    for (const g of GUIDES) {
      expect(g.slug).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
      expect(categorySlugs.has(g.category)).toBe(true);
      expect(g.published <= g.updated).toBe(true);
      expect(g.description.length).toBeGreaterThan(70);
      expect(g.description.length).toBeLessThanOrEqual(160);
    }
  });

  it("only links to guides and related guides that exist", () => {
    for (const g of GUIDES) {
      for (const r of g.related) expect(slugs.has(r), `${g.slug} → related ${r}`).toBe(true);
      expect(relatedGuides(g).some((r) => r.slug === g.slug)).toBe(false);
      for (const text of [g.intro, ...g.blocks.flatMap(textsOf)]) {
        for (const node of parseGuideInline(text)) {
          if (node.type === "link" && node.href.startsWith("/guides/")) {
            expect(slugs.has(node.href.slice("/guides/".length)), `${g.slug} → ${node.href}`).toBe(true);
          }
        }
      }
    }
  });

  it("has unique heading anchors within each guide", () => {
    for (const g of GUIDES) {
      const ids = g.blocks.filter((b) => b.type === "h2" || b.type === "h3").map((b) => headingId((b as { text: string }).text));
      expect(new Set(ids).size, g.slug).toBe(ids.length);
    }
  });

  it("never shows an empty category and resolves the featured guide", () => {
    expect(categoriesWithGuides().every((c) => c.count > 0)).toBe(true);
    expect(getGuide("forex-trading-for-beginners")).toBeDefined();
  });
});
