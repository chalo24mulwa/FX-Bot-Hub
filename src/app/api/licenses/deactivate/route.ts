import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { withAuthorization } from "@/lib/authorization";
import { checkRateLimit, clientIp } from "@/lib/security/rate-limit";
import { deactivateLicense, LicenseError } from "@/features/licenses/license-service";

const bodySchema = z.object({
  licenseKey: z.string().min(1),
  machineId: z.string().min(1).max(200),
});

/** Frees an activation slot (e.g. the buyer reinstalling on a new machine
 * and retiring the old one) — see license-service.ts. */
export async function POST(request: NextRequest) {
  return withAuthorization(async () => {
    await checkRateLimit(clientIp(request), { bucket: "license:deactivate", limit: 20, windowSeconds: 60 });
    const { licenseKey, machineId } = bodySchema.parse(await request.json());

    try {
      await deactivateLicense(licenseKey, machineId);
      return NextResponse.json({ deactivated: true });
    } catch (err) {
      if (err instanceof LicenseError) {
        return NextResponse.json({ deactivated: false, error: err.message }, { status: err.status });
      }
      throw err;
    }
  });
}
