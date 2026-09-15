import { describe, expect, it } from "vitest";
import { buildEventWhere } from "./calendar-service";

describe("buildEventWhere", () => {
  const from = new Date("2026-09-15T00:00:00.000Z");
  const to = new Date("2026-09-22T00:00:00.000Z");

  it("always bounds by the eventTime range", () => {
    const where = buildEventWhere({ from, to });
    expect(where.eventTime).toEqual({ gte: from, lte: to });
  });

  it("omits filter clauses that are undefined", () => {
    const where = buildEventWhere({ from, to });
    expect(where.currency).toBeUndefined();
    expect(where.country).toBeUndefined();
    expect(where.impact).toBeUndefined();
    expect(where.category).toBeUndefined();
  });

  it("omits filter clauses given an empty array, rather than matching nothing", () => {
    const where = buildEventWhere({ from, to, currencies: [], impacts: [] });
    expect(where.currency).toBeUndefined();
    expect(where.impact).toBeUndefined();
  });

  it("builds an `in` clause for populated filters", () => {
    const where = buildEventWhere({
      from,
      to,
      currencies: ["USD", "EUR"],
      countries: ["United States"],
      impacts: ["HIGH", "MEDIUM"],
      categories: ["CENTRAL_BANK"],
    });
    expect(where.currency).toEqual({ in: ["USD", "EUR"] });
    expect(where.country).toEqual({ in: ["United States"] });
    expect(where.impact).toEqual({ in: ["HIGH", "MEDIUM"] });
    expect(where.category).toEqual({ in: ["CENTRAL_BANK"] });
  });
});
