import { describe, expect, it } from "vitest";
import { formatPriceCents } from "./utils";

describe("formatPriceCents", () => {
  it("formats zero as Free", () => {
    expect(formatPriceCents(0)).toBe("Free");
  });

  it("formats cents as USD currency", () => {
    expect(formatPriceCents(4900)).toBe("$49.00");
  });

  it("respects the given currency", () => {
    expect(formatPriceCents(1000, "EUR")).toBe("€10.00");
  });
});
