import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";

const bodySchema = z.object({
  licenseKey: z.string().min(1),
  productId: z.string().cuid(),
});

/**
 * STUB — API shape for a future MT4/MT5-side license check (an EA/indicator
 * calling out on init to confirm it's allowed to run). This validates the
 * License record and returns a verdict, but nothing in this codebase
 * enforces it inside an actual .ex4/.ex5 binary — there is no real-time
 * activation tracking, no hardware/account-lock, and no MQL-side client.
 * Do not present this as "EA protection" to sellers until that exists;
 * today it's a record of purchase, not a working DRM mechanism.
 */
export async function POST(request: NextRequest) {
  const { licenseKey, productId } = bodySchema.parse(await request.json());

  const license = await db.license.findUnique({
    where: { key: licenseKey },
    select: { productId: true, status: true, expiresAt: true, activations: true, maxActivations: true },
  });

  if (!license || license.productId !== productId) {
    return NextResponse.json({ valid: false, reason: "not_found" });
  }
  if (license.status !== "ACTIVE") {
    return NextResponse.json({ valid: false, reason: "revoked_or_expired" });
  }
  if (license.expiresAt && license.expiresAt < new Date()) {
    return NextResponse.json({ valid: false, reason: "expired" });
  }
  if (license.activations >= license.maxActivations) {
    return NextResponse.json({ valid: false, reason: "activation_limit_reached" });
  }

  return NextResponse.json({ valid: true });
}
