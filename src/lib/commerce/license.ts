import type { LicenseStatus } from "@prisma/client";

/** Pure gating rules, split out from license-service.ts for unit testing
 * without a DB. */

export function isLicenseUsable(status: LicenseStatus, expiresAt: Date | null, now: Date = new Date()): boolean {
  if (status !== "ACTIVE") return false;
  if (expiresAt && expiresAt <= now) return false;
  return true;
}

export function canActivateLicense(activeActivationCount: number, maxActivations: number): boolean {
  return activeActivationCount < maxActivations;
}
