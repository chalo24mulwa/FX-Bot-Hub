import { describe, expect, it } from "vitest";
import { MAX_PRICE_CENTS, centsToDollarString, parseDollarsToCents } from "./price-input";

describe("centsToDollarString", () => {
  it("shows dollars with two decimals, starting at 0.00", () => {
    expect(centsToDollarString(0)).toBe("0.00");
    expect(centsToDollarString(4900)).toBe("49.00");
    expect(centsToDollarString(4950)).toBe("49.50");
    expect(centsToDollarString(5)).toBe("0.05");
    expect(centsToDollarString(123456)).toBe("1234.56");
  });

  it("never shows a negative or broken amount", () => {
    expect(centsToDollarString(-100)).toBe("0.00");
    expect(centsToDollarString(Number.NaN)).toBe("0.00");
    expect(centsToDollarString(undefined)).toBe("0.00");
    expect(centsToDollarString(null)).toBe("0.00");
  });
});

describe("parseDollarsToCents", () => {
  it("reads what a seller types in dollars", () => {
    expect(parseDollarsToCents("0")).toBe(0);
    expect(parseDollarsToCents("0.00")).toBe(0);
    expect(parseDollarsToCents("49")).toBe(4900);
    expect(parseDollarsToCents("49.5")).toBe(4950);
    expect(parseDollarsToCents("49.50")).toBe(4950);
    expect(parseDollarsToCents("$49.50")).toBe(4950);
    expect(parseDollarsToCents(" 1,200.00 ")).toBe(120000);
    expect(parseDollarsToCents(".99")).toBe(99);
    expect(parseDollarsToCents("49.")).toBe(4900);
  });

  it("is exact for amounts that floating point gets wrong", () => {
    expect(parseDollarsToCents("19.99")).toBe(1999);
    expect(parseDollarsToCents("0.07")).toBe(7);
    expect(parseDollarsToCents("1.15")).toBe(115);
    expect(parseDollarsToCents("4.35")).toBe(435);
  });

  it("rejects negatives, extra decimals, text, empty input and absurd amounts", () => {
    for (const bad of ["", " ", "-5", "-0.50", "0.999", "1.234", "abc", "12abc", "1e3", "5..0", "1.2.3", "$", "."]) {
      expect(parseDollarsToCents(bad), JSON.stringify(bad)).toBeNull();
    }
    expect(parseDollarsToCents(String(MAX_PRICE_CENTS / 100))).toBe(MAX_PRICE_CENTS);
    expect(parseDollarsToCents(String(MAX_PRICE_CENTS / 100 + 1))).toBeNull();
    expect(parseDollarsToCents("99999999999999999999")).toBeNull();
  });

  it("round-trips what it displays", () => {
    for (const cents of [0, 1, 99, 100, 1999, 4950, 123456, 99999999]) {
      expect(parseDollarsToCents(centsToDollarString(cents))).toBe(cents);
    }
  });
});
