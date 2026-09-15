import { db } from "@/lib/db";
import { isStaff } from "@/lib/authorization/roles";
import { isLicenseUsable } from "@/lib/commerce/license";
import type { Prisma, UserRole } from "@prisma/client";

export interface EntitlementCheck {
  entitled: boolean;
  reason: "owner" | "staff" | "licensed" | "subscribed" | "not_entitled";
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
 *
 * SUBSCRIPTION-priced products are entitled by an ACTIVE (or still-TRIAL)
 * Subscription instead of a License — see checkout-service.ts, which
 * creates a Subscription rather than a License for those products.
 */
export async function checkEntitlement(
  userId: string,
  userRole: UserRole,
  productId: string
): Promise<EntitlementCheck> {
  const product = await db.product.findUnique({
    where: { id: productId },
    select: { sellerId: true, pricingType: true },
  });
  if (!product) return { entitled: false, reason: "not_entitled" };

  if (product.sellerId === userId) return { entitled: true, reason: "owner" };
  if (isStaff(userRole)) return { entitled: true, reason: "staff" };

  if (product.pricingType === "SUBSCRIPTION") {
    const subscription = await db.subscription.findUnique({ where: { userId_productId: { userId, productId } } });
    if (subscription && (subscription.status === "ACTIVE" || subscription.status === "TRIAL")) {
      return { entitled: true, reason: "subscribed" };
    }
    return { entitled: false, reason: "not_entitled" };
  }

  const license = await db.license.findUnique({
    where: { userId_productId: { userId, productId } },
  });
  if (license && isLicenseUsable(license.status, license.expiresAt)) {
    return { entitled: true, reason: "licensed" };
  }

  return { entitled: false, reason: "not_entitled" };
}

/**
 * Issues a License for (userId, productId) if one doesn't already exist —
 * called once a FREE product's "Get" is confirmed, or an order for it is
 * marked PAID (see src/features/checkout/checkout-service.ts). Idempotent.
 */
export async function ensureLicense(
  userId: string,
  productId: string,
  orderId?: string,
  tx: Prisma.TransactionClient = db
) {
  return tx.license.upsert({
    where: { userId_productId: { userId, productId } },
    update: {},
    create: { userId, productId, orderId, status: "ACTIVE" },
  });
}

export async function recordDownload(input: {
  userId: string;
  productId: string;
  productFileId?: string;
  success?: boolean;
  ipAddress?: string;
  userAgent?: string;
}) {
  return db.download.create({ data: input });
}
