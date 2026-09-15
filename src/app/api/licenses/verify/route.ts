import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { withAuthorization } from "@/lib/authorization";
import { checkRateLimit, clientIp } from "@/lib/security/rate-limit";
import { verifyLicenseKey } from "@/features/licenses/license-service";

const bodySchema = z.object({
  licenseKey: z.string().min(1),
});

/**
 * The real-time check an MT4/MT5 EA (or any external client) calls with
 * just the license key its buyer was issued — no session, no database
 * credentials or secret keys in the request or response, matching the "no
 * secrets inside EA downloads" requirement. The key itself is the
 * credential; this is exactly how license verification works for
 * commercial EAs generally. This is a real, working check against this
 * app's own License/LicenseActivation records — see
 * license-service.ts's doc comments for exactly what it validates
 * (status, expiry, activation count). It is NOT a DRM mechanism baked
 * into a compiled .ex4/.ex5: nothing stops a buyer from distributing their
 * copy of the file itself, only from getting a "valid" answer here without
 * a real license key. Don't present this as "unauthorized copies can't
 * run" to sellers.
 */
export async function POST(request: NextRequest) {
  return withAuthorization(async () => {
    await checkRateLimit(clientIp(request), { bucket: "license:verify", limit: 60, windowSeconds: 60 });
    const { licenseKey } = bodySchema.parse(await request.json());
    const result = await verifyLicenseKey(licenseKey);
    return NextResponse.json(result);
  });
}
