"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/authorization";
import { setLicenseStatus } from "./license-service";

export async function suspendLicenseAction(licenseId: string) {
  const session = await requirePermission("license:manage");
  await setLicenseStatus(licenseId, "SUSPENDED", session.user.id);
  revalidatePath("/admin/licenses");
}

export async function reactivateLicenseAction(licenseId: string) {
  const session = await requirePermission("license:manage");
  await setLicenseStatus(licenseId, "ACTIVE", session.user.id);
  revalidatePath("/admin/licenses");
}

export async function revokeLicenseAction(licenseId: string) {
  const session = await requirePermission("license:manage");
  await setLicenseStatus(licenseId, "REVOKED", session.user.id);
  revalidatePath("/admin/licenses");
}
