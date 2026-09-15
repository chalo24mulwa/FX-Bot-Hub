import { describe, expect, it } from "vitest";
import { computeQualityScore, isRecentlyUpdated } from "./product-quality";

describe("computeQualityScore", () => {
  it("scores 0 when no signals are met", () => {
    const result = computeQualityScore({
      hasDocumentation: false,
      hasScreenshots: false,
      hasCompatibilityInfo: false,
      recentlyUpdated: false,
      verifiedSeller: false,
      hasVerifiedReviews: false,
    });
    expect(result.score).toBe(0);
    expect(result.metCount).toBe(0);
    expect(result.totalCount).toBe(6);
  });

  it("scores 1 when every signal is met", () => {
    const result = computeQualityScore({
      hasDocumentation: true,
      hasScreenshots: true,
      hasCompatibilityInfo: true,
      recentlyUpdated: true,
      verifiedSeller: true,
      hasVerifiedReviews: true,
    });
    expect(result.score).toBe(1);
    expect(result.metCount).toBe(6);
  });

  it("scores partial credit proportionally", () => {
    const result = computeQualityScore({
      hasDocumentation: true,
      hasScreenshots: true,
      hasCompatibilityInfo: false,
      recentlyUpdated: false,
      verifiedSeller: false,
      hasVerifiedReviews: false,
    });
    expect(result.metCount).toBe(2);
    expect(result.totalCount).toBe(6);
    expect(result.score).toBeCloseTo(2 / 6);
  });
});

describe("isRecentlyUpdated", () => {
  const now = new Date("2026-06-01T00:00:00.000Z");

  it("is true for an update from today", () => {
    expect(isRecentlyUpdated(now, now)).toBe(true);
  });

  it("is true just inside the default 180-day window", () => {
    const updatedAt = new Date(now.getTime() - 179 * 86_400_000);
    expect(isRecentlyUpdated(updatedAt, now)).toBe(true);
  });

  it("is false just outside the default 180-day window", () => {
    const updatedAt = new Date(now.getTime() - 181 * 86_400_000);
    expect(isRecentlyUpdated(updatedAt, now)).toBe(false);
  });

  it("respects a custom window", () => {
    const updatedAt = new Date(now.getTime() - 40 * 86_400_000);
    expect(isRecentlyUpdated(updatedAt, now, 30)).toBe(false);
    expect(isRecentlyUpdated(updatedAt, now, 60)).toBe(true);
  });
});
