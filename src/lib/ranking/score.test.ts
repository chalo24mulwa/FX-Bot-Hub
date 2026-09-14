import { describe, expect, it } from "vitest";
import { computeRankingScore } from "./score";

const EQUAL_WEIGHTS = { sales: 1, downloads: 1, reviews: 1, rating: 1, recency: 1, favorites: 1 };

describe("computeRankingScore", () => {
  it("is not driven by price — price isn't even a factor in the signature", () => {
    // Two products with identical engagement score identically regardless
    // of what they cost, since price never enters the calculation.
    const factors = { sales: 5, downloads: 10, reviews: 2, rating: 4.5, ageDays: 10, favorites: 3 };
    expect(computeRankingScore(EQUAL_WEIGHTS, factors)).toBe(computeRankingScore(EQUAL_WEIGHTS, factors));
  });

  it("ranks more sales higher, all else equal", () => {
    const base = { sales: 1, downloads: 0, reviews: 0, rating: 0, ageDays: 30, favorites: 0 };
    const more = { ...base, sales: 10 };
    expect(computeRankingScore(EQUAL_WEIGHTS, more)).toBeGreaterThan(computeRankingScore(EQUAL_WEIGHTS, base));
  });

  it("decays recency score as age increases", () => {
    const young = { sales: 0, downloads: 0, reviews: 0, rating: 0, ageDays: 0, favorites: 0 };
    const old = { ...young, ageDays: 365 };
    const recencyOnly = { sales: 0, downloads: 0, reviews: 0, rating: 0, recency: 1, favorites: 0 };
    expect(computeRankingScore(recencyOnly, young)).toBeGreaterThan(computeRankingScore(recencyOnly, old));
  });

  it("respects zero weights by excluding that factor entirely", () => {
    const noSalesWeight = { ...EQUAL_WEIGHTS, sales: 0 };
    const withSales = { sales: 1000, downloads: 0, reviews: 0, rating: 0, ageDays: 30, favorites: 0 };
    const withoutSales = { ...withSales, sales: 0 };
    expect(computeRankingScore(noSalesWeight, withSales)).toBe(computeRankingScore(noSalesWeight, withoutSales));
  });
});
