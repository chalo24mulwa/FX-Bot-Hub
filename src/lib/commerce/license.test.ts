import { describe, expect, it } from "vitest";
import { canActivateLicense, isLicenseUsable } from "./license";

describe("isLicenseUsable", () => {
  const now = new Date("2026-01-01T00:00:00.000Z");

  it("is usable when ACTIVE with no expiry", () => {
    expect(isLicenseUsable("ACTIVE", null, now)).toBe(true);
  });

  it("is usable when ACTIVE and expiry is in the future", () => {
    expect(isLicenseUsable("ACTIVE", new Date("2026-06-01T00:00:00.000Z"), now)).toBe(true);
  });

  it("is not usable once expired, even if still ACTIVE", () => {
    expect(isLicenseUsable("ACTIVE", new Date("2025-12-31T00:00:00.000Z"), now)).toBe(false);
  });

  it("is not usable when SUSPENDED", () => {
    expect(isLicenseUsable("SUSPENDED", null, now)).toBe(false);
  });

  it("is not usable when REVOKED", () => {
    expect(isLicenseUsable("REVOKED", null, now)).toBe(false);
  });

  it("is not usable when EXPIRED", () => {
    expect(isLicenseUsable("EXPIRED", null, now)).toBe(false);
  });
});

describe("canActivateLicense", () => {
  it("allows activation below the limit", () => {
    expect(canActivateLicense(0, 1)).toBe(true);
    expect(canActivateLicense(2, 3)).toBe(true);
  });

  it("blocks activation at or above the limit", () => {
    expect(canActivateLicense(1, 1)).toBe(false);
    expect(canActivateLicense(5, 3)).toBe(false);
  });
});
