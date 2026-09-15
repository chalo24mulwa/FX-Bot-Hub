import { db } from "@/lib/db";
import { isLicenseUsable, canActivateLicense } from "@/lib/commerce/license";
import { recordSecurityEvent } from "@/repositories/security-event-repository";
import { recordAuditLog } from "@/repositories/audit-log-repository";

export class LicenseError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

export interface LicenseVerifyResult {
  valid: boolean;
  status: string;
  productId?: string;
  expiresAt?: string | null;
  activeActivations?: number;
  maxActivations?: number;
}

/**
 * The server-side check an MT4/MT5 EA (or any external client) calls with
 * just the license key it was issued — it never sees a userId or session.
 * The key itself is the credential; nothing here returns database ids,
 * emails, or anything beyond what's needed to answer "is this key good."
 * See the doc comment on /api/licenses/verify for what this does and does
 * not protect against.
 */
export async function verifyLicenseKey(key: string): Promise<LicenseVerifyResult> {
  const license = await db.license.findUnique({
    where: { key },
    include: { licenseActivations: { where: { deactivatedAt: null } } },
  });
  if (!license) return { valid: false, status: "NOT_FOUND" };

  const usable = isLicenseUsable(license.status, license.expiresAt);
  return {
    valid: usable,
    status: license.status,
    productId: license.productId,
    expiresAt: license.expiresAt?.toISOString() ?? null,
    activeActivations: license.licenseActivations.length,
    maxActivations: license.maxActivations,
  };
}

const MAX_FAILED_ACTIVATIONS_PER_HOUR = 10;

/**
 * Binds a license key to a machine/terminal fingerprint, enforcing
 * maxActivations against real activation rows (not a counter that can
 * drift — see the LicenseActivation model comment). Re-activating an
 * already-active machineId is a no-op success (idempotent, so a retried
 * client request doesn't fail).
 */
export async function activateLicense(key: string, machineId: string, ipAddress?: string) {
  const license = await db.license.findUnique({
    where: { key },
    include: { licenseActivations: { where: { deactivatedAt: null } } },
  });
  if (!license) {
    await recordSecurityEvent({
      type: "MULTIPLE_FAILED_LICENSE_ACTIVATIONS",
      severity: "LOW",
      metadata: { reason: "unknown_key" },
      ipAddress,
    });
    throw new LicenseError("License key not found.", 404);
  }
  if (!isLicenseUsable(license.status, license.expiresAt)) {
    throw new LicenseError(`License is ${license.status.toLowerCase()}.`, 409);
  }

  const existing = license.licenseActivations.find((a) => a.machineId === machineId);
  if (existing) return existing;

  if (!canActivateLicense(license.licenseActivations.length, license.maxActivations)) {
    const recentFailures = await db.securityEvent.count({
      where: {
        type: "MULTIPLE_FAILED_LICENSE_ACTIVATIONS",
        metadata: { path: ["licenseId"], equals: license.id },
        createdAt: { gte: new Date(Date.now() - 60 * 60 * 1000) },
      },
    });
    await recordSecurityEvent({
      userId: license.userId,
      type: "MULTIPLE_FAILED_LICENSE_ACTIVATIONS",
      severity: recentFailures + 1 >= MAX_FAILED_ACTIVATIONS_PER_HOUR ? "HIGH" : "LOW",
      metadata: { licenseId: license.id, reason: "activation_limit_reached" },
      ipAddress,
    });
    throw new LicenseError("Activation limit reached for this license.", 409);
  }

  return db.licenseActivation.create({
    data: { licenseId: license.id, machineId, ipAddress },
  });
}

export async function deactivateLicense(key: string, machineId: string) {
  const license = await db.license.findUnique({ where: { key } });
  if (!license) throw new LicenseError("License key not found.", 404);

  const activation = await db.licenseActivation.findUnique({
    where: { licenseId_machineId: { licenseId: license.id, machineId } },
  });
  if (!activation || activation.deactivatedAt) {
    throw new LicenseError("No active activation found for this machine.", 404);
  }

  return db.licenseActivation.update({
    where: { id: activation.id },
    data: { deactivatedAt: new Date() },
  });
}

/** Admin-only: a reversible hold, distinct from REVOKED (permanent). */
export async function setLicenseStatus(licenseId: string, status: "ACTIVE" | "SUSPENDED" | "REVOKED", actorId: string) {
  const license = await db.license.update({ where: { id: licenseId }, data: { status } });
  await recordAuditLog({
    actorId,
    action: `license.${status.toLowerCase()}`,
    entityType: "License",
    entityId: licenseId,
  });
  return license;
}
