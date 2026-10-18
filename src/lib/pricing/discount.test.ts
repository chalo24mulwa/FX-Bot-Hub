import { describe, expect, it } from "vitest";
import { computeDiscountPercent, normalizePricing, priceDisplay, validatePricing } from "./discount";

describe("computeDiscountPercent", () => {
  it("is ((market - offer) / market) x 100, rounded to a whole percent", () => {
    expect(computeDiscountPercent(10000, 6500)).toBe(35);
    expect(computeDiscountPercent(10000, 7000)).toBe(30);
    expect(computeDiscountPercent(10000, 5000)).toBe(50);
    expect(computeDiscountPercent(4900, 3900)).toBe(20); // 20.4 -> 20
    expect(computeDiscountPercent(9900, 6900)).toBe(30); // 30.30 -> 30
  });

  it("rounds to the nearest whole number, halves up, with no decimals", () => {
    expect(computeDiscountPercent(20000, 12900)).toBe(36); // 35.5 -> 36
    expect(computeDiscountPercent(20000, 13100)).toBe(35); // 34.5 -> 35
    expect(computeDiscountPercent(300, 200)).toBe(33); // 33.33 -> 33
    expect(computeDiscountPercent(300, 100)).toBe(67); // 66.67 -> 67
    expect(Number.isInteger(computeDiscountPercent(12345, 6789))).toBe(true);
  });

  it("returns null unless there is a real, visible discount", () => {
    expect(computeDiscountPercent(null, 5000)).toBeNull();
    expect(computeDiscountPercent(undefined, 5000)).toBeNull();
    expect(computeDiscountPercent(10000, 10000)).toBeNull(); // equal
    expect(computeDiscountPercent(5000, 10000)).toBeNull(); // offer above market
    expect(computeDiscountPercent(10000, 0)).toBeNull(); // free
    expect(computeDiscountPercent(0, 0)).toBeNull();
    expect(computeDiscountPercent(-100, 50)).toBeNull();
    expect(computeDiscountPercent(10000, 9999)).toBeNull(); // 0.01% rounds to 0
    expect(computeDiscountPercent(10000, 9951)).toBeNull(); // 0.49% rounds to 0
    expect(computeDiscountPercent(10000, 9950)).toBe(1); // 0.5% rounds to 1
    expect(computeDiscountPercent(Number.NaN, 5)).toBeNull();
  });

  it("never reads 100% off", () => {
    expect(computeDiscountPercent(100_000_000, 1)).toBe(99);
    expect(computeDiscountPercent(10000, 1)).toBe(99);
  });
});

describe("priceDisplay", () => {
  it("shows the crossed-out price and percent only for a valid discount", () => {
    expect(priceDisplay({ pricingType: "ONE_TIME", priceCents: 6500, marketPriceCents: 10000 })).toEqual({ offerCents: 6500, marketCents: 10000, percent: 35, free: false });
    expect(priceDisplay({ pricingType: "SUBSCRIPTION", priceCents: 1000, marketPriceCents: 2000 }).percent).toBe(50);
  });

  it("shows the normal price for everything else", () => {
    expect(priceDisplay({ pricingType: "ONE_TIME", priceCents: 6500 })).toEqual({ offerCents: 6500, marketCents: null, percent: null, free: false });
    expect(priceDisplay({ pricingType: "ONE_TIME", priceCents: 6500, marketPriceCents: null }).marketCents).toBeNull();
    expect(priceDisplay({ pricingType: "ONE_TIME", priceCents: 6500, marketPriceCents: 6500 }).percent).toBeNull();
    expect(priceDisplay({ pricingType: "ONE_TIME", priceCents: 6500, marketPriceCents: 5000 }).marketCents).toBeNull();
    expect(priceDisplay({ pricingType: "FREE", priceCents: 0, marketPriceCents: 9000 })).toMatchObject({ free: true, percent: null, marketCents: null });
  });
});

describe("validatePricing", () => {
  const ok = (over: object = {}) => validatePricing({ pricingType: "ONE_TIME", priceCents: 6500, marketPriceCents: 10000, ...over });

  it("accepts a valid discount, no market price, and a free product", () => {
    expect(ok()).toBeNull();
    expect(ok({ marketPriceCents: null })).toBeNull();
    expect(ok({ marketPriceCents: undefined })).toBeNull();
    expect(validatePricing({ pricingType: "FREE", priceCents: 0 })).toBeNull();
    expect(validatePricing({ pricingType: "FREE", priceCents: 0, marketPriceCents: 5000 })).toBeNull(); // cleared by normalizePricing
    expect(ok({ pricingType: "SUBSCRIPTION" })).toBeNull();
  });

  it("requires the offer price to be lower than the market price", () => {
    expect(ok({ marketPriceCents: 6500 })).toMatch(/lower than the market price/);
    expect(ok({ marketPriceCents: 5000 })).toMatch(/lower than the market price/);
    expect(ok({ marketPriceCents: 5000 })).toContain("$65.00");
  });

  it("rejects malformed prices", () => {
    expect(ok({ marketPriceCents: 0 })).toMatch(/valid market price/);
    expect(ok({ marketPriceCents: -5 })).toMatch(/valid market price/);
    expect(ok({ marketPriceCents: 10.5 })).toMatch(/valid market price/);
    expect(ok({ marketPriceCents: 10_000_000_000 })).toMatch(/valid market price/);
    expect(ok({ priceCents: -1 })).toMatch(/valid offer price/);
    expect(ok({ priceCents: 1.5 })).toMatch(/valid offer price/);
    expect(ok({ priceCents: 0 })).toMatch(/above \$0\.00/);
    expect(validatePricing({ pricingType: "FREE", priceCents: 500 })).toMatch(/free product/);
  });

  it("rejects a gap too small to display as 1%", () => {
    expect(ok({ priceCents: 9999, marketPriceCents: 10000 })).toMatch(/under 1%/);
    expect(ok({ priceCents: 9950, marketPriceCents: 10000 })).toBeNull();
  });
});

describe("normalizePricing", () => {
  it("clears the market price of a free product and leaves paid ones alone", () => {
    expect(normalizePricing({ pricingType: "FREE", priceCents: 0, marketPriceCents: 5000 }).marketPriceCents).toBeNull();
    expect(normalizePricing({ pricingType: "ONE_TIME", priceCents: 6500, marketPriceCents: 10000 }).marketPriceCents).toBe(10000);
  });
});
