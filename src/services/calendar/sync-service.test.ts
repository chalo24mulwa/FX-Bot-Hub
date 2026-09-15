import { describe, expect, it } from "vitest";
import { shouldDispatchHighImpactAlert } from "./sync-service";

describe("shouldDispatchHighImpactAlert", () => {
  it("alerts for a brand-new HIGH-impact event", () => {
    expect(shouldDispatchHighImpactAlert(false, "HIGH")).toBe(true);
  });

  it("does not alert for a HIGH-impact event that already existed (dedup on re-sync)", () => {
    expect(shouldDispatchHighImpactAlert(true, "HIGH")).toBe(false);
  });

  it("does not alert for a new event below HIGH impact", () => {
    expect(shouldDispatchHighImpactAlert(false, "MEDIUM")).toBe(false);
    expect(shouldDispatchHighImpactAlert(false, "LOW")).toBe(false);
    expect(shouldDispatchHighImpactAlert(false, "HOLIDAY")).toBe(false);
    expect(shouldDispatchHighImpactAlert(false, "OTHER")).toBe(false);
  });

  it("does not alert for an existing, non-HIGH event", () => {
    expect(shouldDispatchHighImpactAlert(true, "MEDIUM")).toBe(false);
  });
});
