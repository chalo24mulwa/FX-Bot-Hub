import { describe, expect, it } from "vitest";
import { applyFilter, buildFilters } from "./filters";
import { checkLogo, detectLogoType, MAX_LOGO_BYTES } from "./logo";
import { brokerInputSchema, moveBy, parseExternalUrl, placeAt, publishBlockers, slugify, splitList } from "./validation";

const baseInput = {
  name: "Example Markets",
  tagline: "",
  officialUrl: "https://www.example.com",
  affiliateUrl: "",
  sponsored: false,
  featured: false,
  features: ["Fast execution"],
  whySelected: "Clear pricing and a wide choice of platforms.",
  bestFor: [] as string[],
  platforms: [] as string[],
  instruments: "",
  accountTypes: "",
  minDeposit: "",
  spreadsInfo: "",
  regulation: "",
  rating: null as number | null,
  ratingNote: "",
  infoVerifiedAt: null as string | null,
  position: null as number | null,
};

describe("parseExternalUrl", () => {
  it("accepts a plain https URL and normalises it", () => {
    expect(parseExternalUrl(" https://www.example.com/open-account?ref=abc ")).toEqual({ ok: true, url: "https://www.example.com/open-account?ref=abc" });
  });

  it.each([
    ["javascript:alert(1)"],
    ["JaVaScRiPt:alert(1)"],
    ["data:text/html,<script>alert(1)</script>"],
    ["http://example.com"],
    ["ftp://example.com"],
    ["//example.com"],
    ["https://user:pass@example.com"],
    ["https://localhost/admin"],
    ["https://127.0.0.1/"],
    ["https://192.168.0.10/"],
    ["https://[::1]/"],
    ["https://intranet/"],
    ["https://printer.local/"],
    ["https://exa mple.com"],
    ["not a url"],
    [""],
  ])("rejects %s", (value) => {
    expect(parseExternalUrl(value).ok).toBe(false);
  });

  it("rejects an over-long address", () => {
    expect(parseExternalUrl(`https://example.com/${"a".repeat(600)}`).ok).toBe(false);
  });
});

describe("brokerInputSchema", () => {
  it("accepts a minimal valid broker and turns blanks into null", () => {
    const parsed = brokerInputSchema.parse(baseInput);
    expect(parsed.affiliateUrl).toBeNull();
    expect(parsed.regulation).toBeNull();
    expect(parsed.rating).toBeNull();
    expect(parsed.infoVerifiedAt).toBeNull();
  });

  it("rejects an unsafe official or affiliate link with a field-specific message", () => {
    const official = brokerInputSchema.safeParse({ ...baseInput, officialUrl: "javascript:alert(1)" });
    expect(official.success).toBe(false);
    if (!official.success) expect(official.error.issues[0].message).toMatch(/Official website/);
    const affiliate = brokerInputSchema.safeParse({ ...baseInput, affiliateUrl: "http://example.com/ref" });
    expect(affiliate.success).toBe(false);
    if (!affiliate.success) expect(affiliate.error.issues[0].message).toMatch(/Affiliate/);
  });

  it("keeps a valid affiliate link", () => {
    expect(brokerInputSchema.parse({ ...baseInput, affiliateUrl: "https://go.example.com/ref/123" }).affiliateUrl).toBe("https://go.example.com/ref/123");
  });

  it("checks the rating range and precision", () => {
    expect(brokerInputSchema.safeParse({ ...baseInput, rating: 4.5 }).success).toBe(true);
    expect(brokerInputSchema.safeParse({ ...baseInput, rating: 0 }).success).toBe(true);
    expect(brokerInputSchema.safeParse({ ...baseInput, rating: 5 }).success).toBe(true);
    expect(brokerInputSchema.safeParse({ ...baseInput, rating: 5.1 }).success).toBe(false);
    expect(brokerInputSchema.safeParse({ ...baseInput, rating: -1 }).success).toBe(false);
    expect(brokerInputSchema.safeParse({ ...baseInput, rating: 4.55 }).success).toBe(false);
    expect(brokerInputSchema.safeParse({ ...baseInput, rating: Number.NaN }).success).toBe(false);
  });

  it("checks the verification date: real, formatted, not in the future", () => {
    expect(brokerInputSchema.safeParse({ ...baseInput, infoVerifiedAt: "2026-01-15" }).success).toBe(true);
    expect(brokerInputSchema.safeParse({ ...baseInput, infoVerifiedAt: "2026-02-30" }).success).toBe(false);
    expect(brokerInputSchema.safeParse({ ...baseInput, infoVerifiedAt: "15/01/2026" }).success).toBe(false);
    expect(brokerInputSchema.safeParse({ ...baseInput, infoVerifiedAt: "2999-01-01" }).success).toBe(false);
  });

  it("limits features, de-duplicates tags and re-cases preset categories", () => {
    expect(brokerInputSchema.safeParse({ ...baseInput, features: Array.from({ length: 9 }, (_, i) => `Feature ${i}`) }).success).toBe(false);
    const parsed = brokerInputSchema.parse({ ...baseInput, bestFor: ["beginners", "Beginners", "Scalpers"], platforms: ["mt4", "MT5", "mt4"] });
    expect(parsed.bestFor).toEqual(["Beginners", "Scalpers"]);
    expect(parsed.platforms).toEqual(["MT4", "MT5"]);
  });

  it("requires a name and a sane position", () => {
    expect(brokerInputSchema.safeParse({ ...baseInput, name: "A" }).success).toBe(false);
    expect(brokerInputSchema.safeParse({ ...baseInput, position: 0 }).success).toBe(false);
    expect(brokerInputSchema.safeParse({ ...baseInput, position: 2.5 }).success).toBe(false);
    expect(brokerInputSchema.safeParse({ ...baseInput, position: 3 }).success).toBe(true);
  });

  it("keeps markup as plain text (React escapes it on render) but caps length", () => {
    const parsed = brokerInputSchema.parse({ ...baseInput, whySelected: "<script>alert(1)</script> fine" });
    expect(parsed.whySelected).toContain("<script>");
    expect(brokerInputSchema.safeParse({ ...baseInput, whySelected: "x".repeat(801) }).success).toBe(false);
  });
});

describe("publishBlockers", () => {
  const ready = {
    officialUrl: "https://example.com/",
    whySelected: "Because.",
    features: ["Fast"],
    regulation: null,
    platforms: [] as string[],
    instruments: null,
    accountTypes: null,
    minDeposit: null,
    spreadsInfo: null,
    rating: null,
    infoVerifiedAt: null,
  };

  it("lets a complete listing with no factual claims go public", () => {
    expect(publishBlockers(ready)).toEqual([]);
  });

  it("needs a reason and a feature", () => {
    expect(publishBlockers({ ...ready, whySelected: "  " })).toHaveLength(1);
    expect(publishBlockers({ ...ready, features: [] })).toHaveLength(1);
  });

  it("won't publish regulation, platforms, costs or a rating without a verification date", () => {
    for (const patch of [{ regulation: "FCA" }, { platforms: ["MT4"] }, { minDeposit: "$100" }, { rating: 4 }, { spreadsInfo: "From 0.1" }]) {
      expect(publishBlockers({ ...ready, ...patch })).toHaveLength(1);
      expect(publishBlockers({ ...ready, ...patch, infoVerifiedAt: "2026-01-01" })).toEqual([]);
    }
  });
});

describe("ordering", () => {
  const ids = ["a", "b", "c", "d"];
  it("places a broker at a 1-based position, clamped", () => {
    expect(placeAt(ids, "d", 1)).toEqual(["d", "a", "b", "c"]);
    expect(placeAt(ids, "a", 3)).toEqual(["b", "c", "a", "d"]);
    expect(placeAt(ids, "a", 99)).toEqual(["b", "c", "d", "a"]);
    expect(placeAt(ids, "a", -5)).toEqual(ids);
    expect(placeAt(ids, "zzz", 2)).toEqual(ids);
  });
  it("moves one step and stops at the ends", () => {
    expect(moveBy(ids, "b", -1)).toEqual(["b", "a", "c", "d"]);
    expect(moveBy(ids, "b", 1)).toEqual(["a", "c", "b", "d"]);
    expect(moveBy(ids, "a", -1)).toEqual(ids);
    expect(moveBy(ids, "d", 1)).toEqual(ids);
  });
});

describe("helpers", () => {
  it("slugifies names", () => {
    expect(slugify("IC Markets (Global)")).toBe("ic-markets-global");
    expect(slugify("  Équity & Co. ")).toBe("equity-co");
  });
  it("splits lists, dropping blanks and duplicates", () => {
    expect(splitList("a, B\n\nb,  c ")).toEqual(["a", "B", "c"]);
  });
});

describe("filters", () => {
  const brokers = [
    { bestFor: ["Beginners", "Low-spread trading"], platforms: ["MT4", "MT5"], regulation: "FCA" },
    { bestFor: ["Algorithmic trading", "Scalpers"], platforms: ["cTrader"], regulation: null },
    { bestFor: [], platforms: [], regulation: "  " },
  ];

  it("offers only filters the data supports", () => {
    const keys = buildFilters(brokers).map((f) => f.key);
    expect(keys).toEqual(["mt4-mt5", "regulated", "beginners", "algorithmic-trading", "low-spread-trading", "scalpers"]);
    expect(buildFilters([{ bestFor: [], platforms: [], regulation: null }])).toEqual([]);
  });

  it("counts matches per filter", () => {
    const counts = Object.fromEntries(buildFilters(brokers).map((f) => [f.key, f.count]));
    expect(counts).toMatchObject({ "mt4-mt5": 1, regulated: 1, beginners: 1, scalpers: 1 });
  });

  it("applies a filter, and ignores an unknown one", () => {
    expect(applyFilter(brokers, "beginners")).toEqual([brokers[0]]);
    expect(applyFilter(brokers, "regulated")).toEqual([brokers[0]]);
    expect(applyFilter(brokers, "mt4-mt5")).toEqual([brokers[0]]);
    expect(applyFilter(brokers, "nonsense")).toEqual(brokers);
    expect(applyFilter(brokers, undefined)).toEqual(brokers);
  });
});

describe("logo checks", () => {
  const png = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
  const jpg = Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 0, 0]);
  const webp = Uint8Array.from([...Buffer.from("RIFF"), 0, 0, 0, 0, ...Buffer.from("WEBP")]);

  it("recognises PNG, JPEG and WebP by their bytes", () => {
    expect(detectLogoType(png)).toBe("image/png");
    expect(detectLogoType(jpg)).toBe("image/jpeg");
    expect(detectLogoType(webp)).toBe("image/webp");
  });

  it("rejects SVG, HTML and anything else, whatever it claims to be", () => {
    expect(checkLogo(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>')).ok).toBe(false);
    expect(checkLogo(Buffer.from("<html><script>alert(1)</script></html>")).ok).toBe(false);
    expect(checkLogo(Buffer.from("GIF89a...")).ok).toBe(false);
    expect(checkLogo(new Uint8Array()).ok).toBe(false);
  });

  it("enforces the size cap", () => {
    const big = new Uint8Array(MAX_LOGO_BYTES + 1);
    big.set(png);
    expect(checkLogo(big).ok).toBe(false);
    const ok = new Uint8Array(MAX_LOGO_BYTES);
    ok.set(png);
    expect(checkLogo(ok)).toEqual({ ok: true, mime: "image/png" });
  });
});

import { reorderWithin } from "./validation";

describe("reorderWithin", () => {
  it("reorders a group in place without moving anyone outside it", () => {
    // d1 and d2 are drafts; p1..p3 are published. Moving p3 to the top of the published group.
    const all = ["p1", "d1", "p2", "d2", "p3"];
    const published = new Set(["p1", "p2", "p3"]);
    expect(reorderWithin(all, published, placeAt(["p1", "p2", "p3"], "p3", 1))).toEqual(["p3", "d1", "p1", "d2", "p2"]);
    expect(reorderWithin(all, published, moveBy(["p1", "p2", "p3"], "p2", -1))).toEqual(["p2", "d1", "p1", "d2", "p3"]);
  });
});

import { brokerCta, displayHost, officialLink } from "./links";

describe("broker links", () => {
  it("uses the official site and says so when there is no affiliate link", () => {
    const cta = brokerCta({ officialUrl: "https://example.com/", affiliateUrl: null });
    expect(cta).toEqual({ href: "https://example.com/", label: "Visit Broker", rel: "noopener noreferrer", isAffiliate: false });
    expect(officialLink({ officialUrl: "https://example.com/", affiliateUrl: null })).toBeNull();
  });

  it("uses the affiliate link for the main button, marked sponsored, and keeps the official site reachable", () => {
    const links = { officialUrl: "https://example.com/", affiliateUrl: "https://go.example.com/ref/1" };
    const cta = brokerCta(links);
    expect(cta.href).toBe("https://go.example.com/ref/1");
    expect(cta.label).toBe("Join Broker");
    expect(cta.isAffiliate).toBe(true);
    expect(cta.rel.split(" ")).toEqual(expect.arrayContaining(["sponsored", "nofollow", "noopener", "noreferrer"]));
    expect(officialLink(links)).toEqual({ href: "https://example.com/", rel: "noopener noreferrer" });
  });

  it("shows a bare host", () => {
    expect(displayHost("https://www.example.com/path?x=1")).toBe("example.com");
  });
});
