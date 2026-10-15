import { describe, expect, it } from "vitest";
import { applyVpsFilter, buildVpsFilters } from "./filters";
import { checkVpsImage, fitWithin, MAX_VPS_COVER_BYTES, MAX_VPS_LOGO_BYTES } from "./images";
import { formatStartingPrice, isOfferActive, officialVpsLink, vpsCta } from "./present";
import { parsePriceToCents, vpsInputSchema, vpsPublishBlockers } from "./validation";

const baseInput = {
  name: "Example Hosting",
  category: "",
  headline: "",
  description: "",
  officialUrl: "https://www.example-hosting.com",
  affiliateUrl: "",
  ctaLabel: "",
  promoCode: "",
  offerText: "",
  offerExpiresAt: "",
  sponsored: false,
  disclosureNote: "",
  featured: false,
  features: ["Always-on Windows servers"],
  advantages: [] as string[],
  limitations: [] as string[],
  whyRecommend: "Simple setup for MetaTrader users.",
  bestFor: [] as string[],
  operatingSystems: [] as string[],
  serverLocations: [] as string[],
  platforms: [] as string[],
  cpu: "",
  ram: "",
  storage: "",
  otherSpecs: "",
  price: "",
  priceCurrency: "",
  pricePeriod: "",
  freeTrial: false,
  trialNote: "",
  latencyInfo: "",
  latencySource: "",
  rating: null as number | null,
  ratingNote: "",
  seoTitle: "",
  seoDescription: "",
  infoVerifiedAt: null as string | null,
  position: null as number | null,
};

describe("vpsInputSchema", () => {
  it("accepts a minimal provider and turns blanks into null", () => {
    const parsed = vpsInputSchema.parse(baseInput);
    expect(parsed.affiliateUrl).toBeNull();
    expect(parsed.price).toBeNull();
    expect(parsed.priceCurrency).toBeNull();
    expect(parsed.offerExpiresAt).toBeNull();
    expect(parsed.ctaLabel).toBeNull();
  });

  it("rejects unsafe official or affiliate links with a field-specific message", () => {
    for (const bad of ["javascript:alert(1)", "http://example.com", "https://localhost/", "data:text/html,x", "https://user:pw@example.com"]) {
      const official = vpsInputSchema.safeParse({ ...baseInput, officialUrl: bad });
      expect(official.success, bad).toBe(false);
      if (!official.success) expect(official.error.issues[0].message).toMatch(/Official website/);
      const aff = vpsInputSchema.safeParse({ ...baseInput, affiliateUrl: bad });
      expect(aff.success, bad).toBe(false);
      if (!aff.success) expect(aff.error.issues[0].message).toMatch(/Affiliate/);
    }
  });

  it("only lets the button text be one of the offered labels", () => {
    expect(vpsInputSchema.safeParse({ ...baseInput, ctaLabel: "Get VPS" }).success).toBe(true);
    expect(vpsInputSchema.safeParse({ ...baseInput, ctaLabel: "Click here <b>now</b>" }).success).toBe(false);
  });

  it("keeps price, currency and period together, and parses the amount to cents", () => {
    const ok = vpsInputSchema.parse({ ...baseInput, price: "9.99", priceCurrency: "usd", pricePeriod: "month" });
    expect(ok).toMatchObject({ price: 999, priceCurrency: "USD", pricePeriod: "MONTH" });
    expect(vpsInputSchema.safeParse({ ...baseInput, price: "9.99" }).success).toBe(false);
    expect(vpsInputSchema.safeParse({ ...baseInput, priceCurrency: "USD", pricePeriod: "MONTH" }).success).toBe(false);
    expect(vpsInputSchema.safeParse({ ...baseInput, price: "free", priceCurrency: "USD", pricePeriod: "MONTH" }).success).toBe(false);
    expect(vpsInputSchema.safeParse({ ...baseInput, price: "9.99", priceCurrency: "DOLLARS", pricePeriod: "MONTH" }).success).toBe(false);
    expect(vpsInputSchema.safeParse({ ...baseInput, price: "9.99", priceCurrency: "USD", pricePeriod: "WEEK" }).success).toBe(false);
  });

  it("parses prices strictly", () => {
    expect(parsePriceToCents("")).toBeNull();
    expect(parsePriceToCents("12")).toBe(1200);
    expect(parsePriceToCents("0.5")).toBe(50);
    expect(parsePriceToCents("0")).toBe("invalid");
    expect(parsePriceToCents("-3")).toBe("invalid");
    expect(parsePriceToCents("1,000")).toBe("invalid");
    expect(parsePriceToCents("9.999")).toBe("invalid");
  });

  it("validates the promo code, offer date, rating and verification date", () => {
    expect(vpsInputSchema.safeParse({ ...baseInput, promoCode: "FXBOT-10" }).success).toBe(true);
    expect(vpsInputSchema.safeParse({ ...baseInput, promoCode: "10% off!" }).success).toBe(false);
    expect(vpsInputSchema.safeParse({ ...baseInput, offerExpiresAt: "2026-12-31" }).success).toBe(true);
    expect(vpsInputSchema.safeParse({ ...baseInput, offerExpiresAt: "2026-02-30" }).success).toBe(false);
    expect(vpsInputSchema.safeParse({ ...baseInput, rating: 4.5 }).success).toBe(true);
    expect(vpsInputSchema.safeParse({ ...baseInput, rating: 5.5 }).success).toBe(false);
    expect(vpsInputSchema.safeParse({ ...baseInput, rating: 4.55 }).success).toBe(false);
    expect(vpsInputSchema.safeParse({ ...baseInput, infoVerifiedAt: "2999-01-01" }).success).toBe(false);
    expect(vpsInputSchema.safeParse({ ...baseInput, infoVerifiedAt: "2026-01-10" }).success).toBe(true);
  });

  it("re-cases preset categories/OS/platforms, de-duplicates, and caps list sizes", () => {
    const parsed = vpsInputSchema.parse({
      ...baseInput,
      bestFor: ["multiple eas", "Multiple EAs", "Scalping"],
      operatingSystems: ["windows server"],
      platforms: ["mt5", "MT5"],
      serverLocations: ["London", "london", "New York"],
    });
    expect(parsed.bestFor).toEqual(["Multiple EAs", "Scalping"]);
    expect(parsed.operatingSystems).toEqual(["Windows Server"]);
    expect(parsed.platforms).toEqual(["MT5"]);
    expect(parsed.serverLocations).toEqual(["London", "New York"]);
    expect(vpsInputSchema.safeParse({ ...baseInput, features: Array.from({ length: 9 }, (_, i) => `F${i}`) }).success).toBe(false);
    expect(vpsInputSchema.safeParse({ ...baseInput, limitations: Array.from({ length: 6 }, (_, i) => `L${i}`) }).success).toBe(false);
  });

  it("keeps markup as plain text (React escapes it) but caps lengths", () => {
    expect(vpsInputSchema.parse({ ...baseInput, description: "<script>alert(1)</script> ok" }).description).toContain("<script>");
    expect(vpsInputSchema.safeParse({ ...baseInput, description: "x".repeat(2001) }).success).toBe(false);
    expect(vpsInputSchema.safeParse({ ...baseInput, seoTitle: "x".repeat(71) }).success).toBe(false);
    expect(vpsInputSchema.safeParse({ ...baseInput, seoDescription: "x".repeat(161) }).success).toBe(false);
  });
});

describe("vpsPublishBlockers", () => {
  const ready = {
    officialUrl: "https://example.com/",
    whyRecommend: "Because.",
    features: ["Fast"],
    operatingSystems: [] as string[],
    serverLocations: [] as string[],
    platforms: [] as string[],
    cpu: null,
    ram: null,
    storage: null,
    otherSpecs: null,
    priceCents: null,
    trialNote: null,
    latencyInfo: null,
    latencySource: null,
    freeTrial: false,
    rating: null,
    infoVerifiedAt: null,
  };

  it("lets a complete listing with no factual claims go public", () => {
    expect(vpsPublishBlockers(ready)).toEqual([]);
  });

  it("needs a reason and a feature", () => {
    expect(vpsPublishBlockers({ ...ready, whyRecommend: " " })).toHaveLength(1);
    expect(vpsPublishBlockers({ ...ready, features: [] })).toHaveLength(1);
  });

  it("won't publish specs, prices, locations, trials or a rating without a verification date", () => {
    for (const patch of [{ ram: "4 GB" }, { serverLocations: ["London"] }, { priceCents: 999 }, { freeTrial: true }, { rating: 4 }, { operatingSystems: ["Windows Server"] }]) {
      expect(vpsPublishBlockers({ ...ready, ...patch })).toHaveLength(1);
      expect(vpsPublishBlockers({ ...ready, ...patch, infoVerifiedAt: "2026-01-01" })).toEqual([]);
    }
  });

  it("won't publish latency numbers without their source", () => {
    const withLatency = { ...ready, latencyInfo: "Under 2 ms to a London data centre", infoVerifiedAt: "2026-01-01" };
    expect(vpsPublishBlockers(withLatency)).toHaveLength(1);
    expect(vpsPublishBlockers({ ...withLatency, latencySource: "Provider's published test, 1 Jan 2026" })).toEqual([]);
  });
});

describe("presentation", () => {
  it("formats a price only when it is complete", () => {
    expect(formatStartingPrice({ priceCents: 999, priceCurrency: "USD", pricePeriod: "MONTH" })).toBe("From $9.99 / month");
    expect(formatStartingPrice({ priceCents: 12000, priceCurrency: "EUR", pricePeriod: "YEAR" })).toBe("From €120.00 / year");
    expect(formatStartingPrice({ priceCents: 999, priceCurrency: null, pricePeriod: "MONTH" })).toBeNull();
    expect(formatStartingPrice({ priceCents: null, priceCurrency: "USD", pricePeriod: "MONTH" })).toBeNull();
    expect(formatStartingPrice({ priceCents: 999, priceCurrency: "USD", pricePeriod: "WEEK" })).toBeNull();
  });

  it("hides an offer after its expiry day but not on it", () => {
    const now = new Date("2026-06-15T12:00:00Z");
    expect(isOfferActive(null, now)).toBe(true);
    expect(isOfferActive(new Date("2026-06-15T00:00:00Z"), now)).toBe(true);
    expect(isOfferActive("2026-06-14", now)).toBe(false);
    expect(isOfferActive(new Date("2026-12-31T00:00:00Z"), now)).toBe(true);
  });

  it("uses the affiliate link for the main button, marked sponsored, and the chosen text", () => {
    const cta = vpsCta({ officialUrl: "https://a.com/", affiliateUrl: "https://go.a.com/r", ctaLabel: "View Plans" });
    expect(cta).toMatchObject({ href: "https://go.a.com/r", label: "View Plans", isAffiliate: true });
    expect(cta.rel.split(" ")).toEqual(expect.arrayContaining(["sponsored", "nofollow", "noopener", "noreferrer"]));
    expect(vpsCta({ officialUrl: "https://a.com/", affiliateUrl: "https://go.a.com/r", ctaLabel: null }).label).toBe("Get VPS");
    expect(officialVpsLink({ officialUrl: "https://a.com/", affiliateUrl: "https://go.a.com/r", ctaLabel: null })?.href).toBe("https://a.com/");
  });

  it("falls back to the official site, unmarked, when there is no affiliate link", () => {
    const cta = vpsCta({ officialUrl: "https://a.com/", affiliateUrl: null, ctaLabel: null });
    expect(cta).toEqual({ href: "https://a.com/", label: "Visit Provider", rel: "noopener noreferrer", isAffiliate: false });
    expect(officialVpsLink({ officialUrl: "https://a.com/", affiliateUrl: null, ctaLabel: null })).toBeNull();
  });
});

describe("filters", () => {
  const providers = [
    { bestFor: ["Beginners", "Budget-friendly"], platforms: ["MT4", "MT5"], operatingSystems: ["Windows Server"], serverLocations: ["London", "New York"], freeTrial: true },
    { bestFor: ["Multiple EAs", "Scalping"], platforms: [], operatingSystems: ["Linux"], serverLocations: ["London"], freeTrial: false },
    { bestFor: [], platforms: [], operatingSystems: [], serverLocations: [], freeTrial: false },
  ];

  it("offers only filters the data supports, in a sensible order", () => {
    const keys = buildVpsFilters(providers).map((f) => f.key);
    expect(keys).toEqual(["mt4-mt5", "windows", "free-trial", "beginners", "multiple-eas", "budget-friendly", "scalping", "region-london", "region-new-york"]);
    expect(buildVpsFilters([providers[2]])).toEqual([]);
  });

  it("counts matches and labels regions plainly", () => {
    const byKey = Object.fromEntries(buildVpsFilters(providers).map((f) => [f.key, f]));
    expect(byKey["region-london"]).toMatchObject({ count: 2, label: "Servers in London" });
    expect(byKey["windows"].count).toBe(1);
    expect(byKey["free-trial"].count).toBe(1);
  });

  it("applies a filter and ignores an unknown one", () => {
    expect(applyVpsFilter(providers, "windows")).toEqual([providers[0]]);
    expect(applyVpsFilter(providers, "region-london")).toEqual([providers[0], providers[1]]);
    expect(applyVpsFilter(providers, "free-trial")).toEqual([providers[0]]);
    expect(applyVpsFilter(providers, "multiple-eas")).toEqual([providers[1]]);
    expect(applyVpsFilter(providers, "nonsense")).toEqual(providers);
    expect(applyVpsFilter(providers, undefined)).toEqual(providers);
  });

  it("treats the MT4/MT5-users category as the MT filter, not a second chip", () => {
    const list = [{ bestFor: ["MT4/MT5 users"], platforms: [], operatingSystems: [], serverLocations: [], freeTrial: false }];
    expect(buildVpsFilters(list).map((f) => f.key)).toEqual(["mt4-mt5"]);
  });

  it("caps the number of region filters", () => {
    const many = Array.from({ length: 10 }, (_, i) => ({ bestFor: [], platforms: [], operatingSystems: [], serverLocations: [`City ${i}`], freeTrial: false }));
    expect(buildVpsFilters(many).filter((f) => f.key.startsWith("region-"))).toHaveLength(6);
  });
});

describe("image checks", () => {
  const png = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);

  it("accepts a real raster image within each cap", () => {
    expect(checkVpsImage(png, "logo")).toEqual({ ok: true, mime: "image/png" });
    expect(checkVpsImage(png, "cover")).toEqual({ ok: true, mime: "image/png" });
  });

  it("rejects SVG/HTML/anything unrecognised and empty files", () => {
    expect(checkVpsImage(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'), "cover").ok).toBe(false);
    expect(checkVpsImage(Buffer.from("<html></html>"), "logo").ok).toBe(false);
    expect(checkVpsImage(new Uint8Array(), "logo").ok).toBe(false);
  });

  it("has different caps for logos and covers", () => {
    const big = new Uint8Array(MAX_VPS_LOGO_BYTES + 1);
    big.set(png);
    expect(checkVpsImage(big, "logo").ok).toBe(false);
    expect(checkVpsImage(big, "cover").ok).toBe(true);
    const huge = new Uint8Array(MAX_VPS_COVER_BYTES + 1);
    huge.set(png);
    expect(checkVpsImage(huge, "cover").ok).toBe(false);
  });

  it("fits images inside a box without enlarging", () => {
    expect(fitWithin(4000, 1000, 1280)).toEqual({ width: 1280, height: 320 });
    expect(fitWithin(600, 300, 1280)).toEqual({ width: 600, height: 300 });
    expect(fitWithin(0, 0, 100)).toEqual({ width: 1, height: 1 });
  });
});
