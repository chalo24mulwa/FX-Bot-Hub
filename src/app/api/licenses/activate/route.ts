import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { withAuthorization } from "@/lib/authorization";
import { checkRateLimit, clientIp } from "@/lib/security/rate-limit";
import { activateLicense, LicenseError } from "@/features/licenses/license-service";

const bodySchema = z.object({
  licenseKey: z.string().min(1),
  machineId: z.string().min(1).max(200),
});

/** Called by an EA/indicator on first run for a given machine/terminal —
 * see license-service.ts's activateLicense doc comment. */
export async function POST(request: NextRequest) {
  return withAuthorization(async () => {
    const ip = clientIp(request);
    await checkRateLimit(ip, { bucket: "license:activate", limit: 20, windowSeconds: 60 });
    const { licenseKey, machineId } = bodySchema.parse(await request.json());

    try {
      const activation = await activateLicense(licenseKey, machineId, ip);
      return NextResponse.json({ activated: true, activatedAt: activation.activatedAt });
    } catch (err) {
      if (err instanceof LicenseError) {
        return NextResponse.json({ activated: false, error: err.message }, { status: err.status });
      }
      throw err;
    }
  });
}
