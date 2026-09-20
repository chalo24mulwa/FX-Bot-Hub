import { describe, expect, it } from "vitest";
import { isSyncDue } from "./auto-sync";

describe("isSyncDue", () => {
  const now = new Date("2026-09-20T12:00:00Z");

  it("is due when the source has never synced", () => {
    expect(isSyncDue(null, now, 60)).toBe(true);
  });

  it("is not due inside the interval, so page views can't cause extra upstream calls", () => {
    expect(isSyncDue(new Date("2026-09-20T11:01:00Z"), now, 60)).toBe(false);
  });

  it("is due exactly at, and after, the interval", () => {
    expect(isSyncDue(new Date("2026-09-20T11:00:00Z"), now, 60)).toBe(true);
    expect(isSyncDue(new Date("2026-09-19T00:00:00Z"), now, 60)).toBe(true);
  });

  it("honours a custom interval", () => {
    expect(isSyncDue(new Date("2026-09-20T11:50:00Z"), now, 5)).toBe(true);
    expect(isSyncDue(new Date("2026-09-20T11:50:00Z"), now, 15)).toBe(false);
  });
});
