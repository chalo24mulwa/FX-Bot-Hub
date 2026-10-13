import { describe, expect, it } from "vitest";
import { describeMarketplaceLanding, marketplaceLandingPath } from "./marketplace-landing";

describe("marketplaceLandingPath", () => {
  it("is /marketplace with no defining filters", () => {
    expect(marketplaceLandingPath({})).toBe("/marketplace");
  });

  it("keeps platform and type in a fixed order matching the header links", () => {
    expect(marketplaceLandingPath({ type: "EA", platform: "MT4" })).toBe("/marketplace?platform=MT4&type=EA");
  });

  it("ignores unknown values and keeps page only past page 1", () => {
    expect(marketplaceLandingPath({ platform: "MULTI_PLATFORM", type: "OTHER", page: 1 })).toBe("/marketplace");
    expect(marketplaceLandingPath({ platform: "MT5", page: 3 })).toBe("/marketplace?platform=MT5&page=3");
  });

  it("encodes category slugs", () => {
    expect(marketplaceLandingPath({ categorySlug: "scalping eas" })).toBe("/marketplace?categorySlug=scalping+eas");
  });
});

describe("describeMarketplaceLanding", () => {
  it("names the MT4 EA view", () => {
    const landing = describeMarketplaceLanding({ platform: "MT4", type: "EA" });
    expect(landing.heading).toBe("MT4 Expert Advisors");
    expect(landing.title).toBe("MT4 Expert Advisors");
    expect(landing.canonicalPath).toBe("/marketplace?platform=MT4&type=EA");
    expect(landing.noindex).toBe(false);
  });

  it("keeps the plain Marketplace heading for unfiltered and sort-only views", () => {
    expect(describeMarketplaceLanding({}).heading).toBe("Marketplace");
  });

  it("noindexes free-text search results but canonicalises them to the base view", () => {
    const landing = describeMarketplaceLanding({ q: "grid" });
    expect(landing.noindex).toBe(true);
    expect(landing.canonicalPath).toBe("/marketplace");
  });

  it("uses the category name when known", () => {
    const landing = describeMarketplaceLanding({ categorySlug: "scalping", categoryName: "Scalping" });
    expect(landing.heading).toBe("Scalping");
    expect(landing.canonicalPath).toBe("/marketplace?categorySlug=scalping");
  });

  it("gives later pages distinct titles", () => {
    expect(describeMarketplaceLanding({ type: "INDICATOR", page: 2 }).title).toBe("Indicators for MT4 and MT5 — Page 2");
  });
});
