import { db } from "@/lib/db";
import { recordAuditLog } from "@/repositories/audit-log-repository";
import { createNotification } from "@/repositories/notification-repository";
import { enqueueEmail } from "@/jobs/send-email";
import { buildProductApprovedEmail, buildProductRejectedEmail } from "@/emails/templates";

const siteUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

interface ModerationActionInput {
  actorId: string;
  productId: string;
  reason?: string;
  ipAddress?: string;
}

async function loadProductOrThrow(productId: string) {
  const product = await db.product.findUnique({
    where: { id: productId },
    include: { seller: { select: { email: true } } },
  });
  if (!product) throw new Error("Product not found.");
  return product;
}

/** Claims a PENDING_REVIEW product for active review — moves it to
 * UNDER_REVIEW and records the moderator so the queue shows who's on it. */
export async function claimForReview({ actorId, productId, ipAddress }: ModerationActionInput) {
  const result = await db.product.updateMany({
    where: { id: productId, status: "PENDING_REVIEW" },
    data: { status: "UNDER_REVIEW", assignedModeratorId: actorId },
  });
  if (result.count === 0) throw new Error("Product is not awaiting review.");

  await recordAuditLog({ actorId, action: "product.claim_review", entityType: "Product", entityId: productId, ipAddress });
  return db.product.findUniqueOrThrow({ where: { id: productId } });
}

export async function approveProduct({ actorId, productId, ipAddress }: ModerationActionInput) {
  const product = await loadProductOrThrow(productId);

  const updated = await db.product.update({
    where: { id: productId },
    data: {
      status: "PUBLISHED",
      publishedAt: product.publishedAt ?? new Date(),
      rejectionReason: null,
      assignedModeratorId: null,
    },
  });

  await Promise.all([
    recordAuditLog({
      actorId,
      action: "product.approve",
      entityType: "Product",
      entityId: productId,
      ipAddress,
    }),
    createNotification({
      userId: product.sellerId,
      type: "PRODUCT_APPROVED",
      title: `"${product.name}" was approved`,
      body: "Your product is now live on the marketplace.",
      link: `/marketplace/${product.slug}`,
    }),
  ]);

  // Fire-and-forget: never let email delivery add latency to a moderation action.
  void enqueueEmail(
    product.seller.email,
    buildProductApprovedEmail(product.name, `${siteUrl}/marketplace/${product.slug}`)
  );

  return updated;
}

export async function rejectProduct({ actorId, productId, reason, ipAddress }: ModerationActionInput) {
  const product = await loadProductOrThrow(productId);

  const updated = await db.product.update({
    where: { id: productId },
    data: { status: "REJECTED", rejectionReason: reason ?? null, assignedModeratorId: null },
  });

  await Promise.all([
    recordAuditLog({
      actorId,
      action: "product.reject",
      entityType: "Product",
      entityId: productId,
      metadata: reason ? { reason } : undefined,
      ipAddress,
    }),
    createNotification({
      userId: product.sellerId,
      type: "PRODUCT_REJECTED",
      title: `"${product.name}" was rejected`,
      body: reason ?? "Your product did not pass review. Edit and resubmit.",
      link: `/seller/products/${product.id}`,
    }),
  ]);

  void enqueueEmail(product.seller.email, buildProductRejectedEmail(product.name, reason));

  return updated;
}

export async function suspendProduct({ actorId, productId, reason, ipAddress }: ModerationActionInput) {
  const product = await loadProductOrThrow(productId);

  const updated = await db.product.update({
    where: { id: productId },
    data: { status: "SUSPENDED" },
  });

  await Promise.all([
    recordAuditLog({
      actorId,
      action: "product.suspend",
      entityType: "Product",
      entityId: productId,
      metadata: reason ? { reason } : undefined,
      ipAddress,
    }),
    createNotification({
      userId: product.sellerId,
      type: "PRODUCT_SUSPENDED",
      title: `"${product.name}" was suspended`,
      body: reason ?? "Your product was suspended and is no longer visible on the marketplace.",
      link: `/seller/products/${product.id}`,
    }),
  ]);

  return updated;
}

export async function setProductFeatured(
  { actorId, productId, ipAddress }: ModerationActionInput,
  featured: boolean
) {
  const updated = await db.product.update({
    where: { id: productId },
    data: { featured },
  });

  await recordAuditLog({
    actorId,
    action: featured ? "product.feature" : "product.unfeature",
    entityType: "Product",
    entityId: productId,
    ipAddress,
  });

  return updated;
}
