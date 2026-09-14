import { db } from "@/lib/db";
import { isStaff } from "@/lib/authorization/roles";
import type { UserRole } from "@prisma/client";

export interface EntitlementCheck {
  entitled: boolean;
  reason: "owner" | "staff" | "licensed" | "not_entitled";
}

/**
 * The single source of truth for "can this user download this product's
 * files." Every download path (the download route, seller preview, admin
 * tools) must go through this — never infer entitlement from the client or
 * from an order's mere existence (it must be PAID).
 *
 * Deliberately NOT free-for-everyone just because pricingType is FREE: a
 * License must still exist (issued by checkoutCart()/completePaidOrder()
 * for a $0 order same as a paid one — see src/features/checkout). That
 * keeps "own" meaning "there's an Order/License record for this user," so
 * Orders history and per-user download entitlement stay consistent whether
 * or not money changed hands. A FREE product's price shows "Free" and
 * checkout completes instantly with no real payment — but the user still
 * has to click through it once.
 */
export async function checkEntitlement(
  userId: string,
  userRole: UserRole,
  productId: string
): Promise<EntitlementCheck> {
  const product = await db.product.findUnique({
    where: { id: productId },
    select: { sellerId: true },
  });
  if (!product) return { entitled: false, reason: "not_entitled" };

  if (product.sellerId === userId) return { entitled: true, reason: "owner" };
  if (isStaff(userRole)) return { entitled: true, reason: "staff" };

  const license = await db.license.findUnique({
    where: { userId_productId: { userId, productId } },
  });
  if (license && license.status === "ACTIVE" && (!license.expiresAt || license.expiresAt > new Date())) {
    return { entitled: true, reason: "licensed" };
  }

  return { entitled: false, reason: "not_entitled" };
}

/**
 * Issues a License for (userId, productId) if one doesn't already exist —
 * called once a FREE product's "Get" is confirmed, or an order for it is
 * marked PAID (see src/features/checkout/checkout-service.ts). Idempotent.
 */
export async function ensureLicense(userId: string, productId: string, orderId?: string) {
  return db.license.upsert({
    where: { userId_productId: { userId, productId } },
    update: {},
    create: { userId, productId, orderId, status: "ACTIVE" },
  });
}

export async function recordDownload(input: {
  userId: string;
  productId: string;
  productFileId?: string;
  ipAddress?: string;
  userAgent?: string;
}) {
  return db.download.create({ data: input });
}
