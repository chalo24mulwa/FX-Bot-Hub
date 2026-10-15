import { z } from "zod";
import type { Prisma, ProductStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { requireReason, cleanReason } from "@/lib/admin/rules";
import { recordAuditLog } from "@/repositories/audit-log-repository";
import { createNotification } from "@/repositories/notification-repository";
import { AdminError, type AdminActor } from "./core";

// Listing moderation beyond approve / reject / suspend (those stay in
// product-moderation-service.ts): take down, remove, restore, edit and delete,
// plus the filtered list and detail the admin pages read. Every change is a
// conditional update (so two moderators can't apply conflicting decisions),
// carries a reason the seller sees, is audited, and notifies the seller.

type Op = "unpublish" | "remove" | "restore";

const TRANSITIONS: Record<Op, { from: ProductStatus[]; needsReason: boolean }> = {
  // Back to the seller as a draft to fix and resubmit — not a rule violation.
  unpublish: { from: ["PUBLISHED"], needsReason: true },
  // Taken off the marketplace for good. Orders, licenses and downloads for existing buyers are untouched.
  remove: { from: ["DRAFT", "PENDING_REVIEW", "UNDER_REVIEW", "PUBLISHED", "REJECTED", "SUSPENDED"], needsReason: true },
  restore: { from: ["SUSPENDED", "ARCHIVED"], needsReason: false },
};

export async function transitionListing(actor: AdminActor, productId: string, op: Op, rawReason: unknown) {
  const rule = TRANSITIONS[op];
  const reasonCheck = rule.needsReason ? requireReason(rawReason) : { ok: true as const, reason: cleanReason(rawReason) };
  if (!reasonCheck.ok) throw new AdminError(reasonCheck.error);
  const reason = reasonCheck.reason;

  const product = await db.product.findUnique({ where: { id: productId }, select: { id: true, name: true, slug: true, sellerId: true, status: true, publishedAt: true } });
  if (!product) throw new AdminError("Listing not found.", 404);

  // A restored listing that was never published goes back through review instead of straight to the marketplace.
  const to: ProductStatus = op === "unpublish" ? "DRAFT" : op === "remove" ? "ARCHIVED" : product.publishedAt ? "PUBLISHED" : "PENDING_REVIEW";

  const updated = await db.product.updateMany({
    where: { id: productId, status: { in: rule.from } },
    data: { status: to, assignedModeratorId: null, rejectionReason: op === "restore" ? null : reason },
  });
  if (updated.count === 0) throw new AdminError(`This listing can't be ${op === "remove" ? "removed" : op === "restore" ? "restored" : "unpublished"} from "${product.status.toLowerCase().replace(/_/g, " ")}".`, 409);

  await recordAuditLog({
    actorId: actor.id,
    action: `product.${op}`,
    entityType: "Product",
    entityId: productId,
    ipAddress: actor.ipAddress,
    metadata: { from: product.status, to, reason: reason || null },
  });

  const copy: Record<Op, { type: "PRODUCT_APPROVED" | "PRODUCT_SUSPENDED"; title: string; body: string }> = {
    unpublish: { type: "PRODUCT_SUSPENDED", title: `"${product.name}" was taken down for changes`, body: reason },
    remove: { type: "PRODUCT_SUSPENDED", title: `"${product.name}" was removed from the marketplace`, body: reason },
    restore: {
      type: "PRODUCT_APPROVED",
      title: `"${product.name}" was restored`,
      body: to === "PUBLISHED" ? "Your listing is live on the marketplace again." : "Your listing has been returned to the review queue.",
    },
  };
  await createNotification({ userId: product.sellerId, link: `/seller/products/${product.id}`, ...copy[op] }).catch(() => undefined);
  return { status: to };
}

const editSchema = z.object({
  name: z.string().trim().min(3, "The name must be at least 3 characters.").max(120),
  shortSummary: z.string().trim().min(10, "The summary must be at least 10 characters.").max(240),
  description: z.string().trim().min(20, "The description must be at least 20 characters.").max(20000),
  categoryId: z.string().trim().max(40).nullable().optional(),
});

/** Permitted fields only. Price, files, ownership and the slug (public URL) are never edited here. */
export async function editListing(actor: AdminActor, productId: string, input: unknown, rawReason: unknown) {
  const data = editSchema.parse(input);
  const reason = requireReason(rawReason);
  if (!reason.ok) throw new AdminError(reason.error);

  const product = await db.product.findUnique({ where: { id: productId }, select: { id: true, name: true, shortSummary: true, description: true, categoryId: true, sellerId: true } });
  if (!product) throw new AdminError("Listing not found.", 404);
  if (data.categoryId) {
    const category = await db.productCategory.findUnique({ where: { id: data.categoryId }, select: { id: true } });
    if (!category) throw new AdminError("That category doesn't exist.");
  }

  const categoryId = data.categoryId || null;
  const changed: string[] = [];
  if (product.name !== data.name) changed.push("name");
  if (product.shortSummary !== data.shortSummary) changed.push("shortSummary");
  if (product.description !== data.description) changed.push("description");
  if (product.categoryId !== categoryId) changed.push("categoryId");
  if (changed.length === 0) throw new AdminError("Nothing changed.");

  await db.product.update({ where: { id: productId }, data: { name: data.name, shortSummary: data.shortSummary, description: data.description, categoryId } });
  await recordAuditLog({
    actorId: actor.id,
    action: "product.admin_edit",
    entityType: "Product",
    entityId: productId,
    ipAddress: actor.ipAddress,
    metadata: { reason: reason.reason, changed, before: { name: product.name.slice(0, 120) } },
  });
  await createNotification({
    userId: product.sellerId,
    type: "GENERAL",
    title: `A moderator edited "${data.name}"`,
    body: `Changed: ${changed.join(", ")}. Reason: ${reason.reason}`,
    link: `/seller/products/${productId}`,
  }).catch(() => undefined);
}

/** What stops a listing being deleted — purchases are history and must survive. */
export async function listingDeleteBlockers(productId: string) {
  const [orderItems, licenses, subscriptions] = await Promise.all([
    db.orderItem.count({ where: { productId } }),
    db.license.count({ where: { productId } }),
    db.subscription.count({ where: { productId } }),
  ]);
  return { orderItems, licenses, subscriptions, blocked: orderItems + licenses + subscriptions > 0 };
}

/**
 * Hard delete — only for a listing nobody has bought. Product relations cascade
 * (including order items and licenses), so with any sales this must refuse: use
 * "Remove" instead, which hides the listing and keeps every purchase and download
 * intact.
 */
export async function deleteListing(actor: AdminActor, productId: string, rawReason: unknown) {
  const reason = requireReason(rawReason);
  if (!reason.ok) throw new AdminError(reason.error);

  const product = await db.product.findUnique({ where: { id: productId }, select: { id: true, name: true, sellerId: true, status: true } });
  if (!product) throw new AdminError("Listing not found.", 404);

  await db.$transaction(
    async (tx) => {
      // Re-checked inside the transaction so a sale can't slip in between the check and the delete.
      const [orderItems, licenses, subscriptions] = await Promise.all([
        tx.orderItem.count({ where: { productId } }),
        tx.license.count({ where: { productId } }),
        tx.subscription.count({ where: { productId } }),
      ]);
      if (orderItems + licenses + subscriptions > 0) {
        throw new AdminError(
          `This listing has ${orderItems} order item(s), ${licenses} license(s) and ${subscriptions} subscription(s). Deleting it would erase that purchase history — use Remove instead.`,
          409,
        );
      }
      await tx.product.delete({ where: { id: productId } });
      await tx.auditLog.create({
        data: {
          actorId: actor.id,
          action: "product.delete",
          entityType: "Product",
          entityId: productId,
          ipAddress: actor.ipAddress,
          metadata: { name: product.name.slice(0, 120), status: product.status, sellerId: product.sellerId, reason: reason.reason },
        },
      });
    },
    { isolationLevel: "Serializable" },
  );
  await createNotification({ userId: product.sellerId, type: "PRODUCT_SUSPENDED", title: `"${product.name}" was deleted`, body: reason.reason }).catch(() => undefined);
}

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

export interface ListingFilter {
  status?: string;
  q?: string;
  seller?: string;
  categoryId?: string;
  from?: Date;
  to?: Date;
}

const STATUSES: ProductStatus[] = ["DRAFT", "PENDING_REVIEW", "UNDER_REVIEW", "PUBLISHED", "REJECTED", "SUSPENDED", "ARCHIVED"];

export function buildListingWhere(filter: ListingFilter): Prisma.ProductWhereInput {
  const and: Prisma.ProductWhereInput[] = [];
  if (filter.status && (STATUSES as string[]).includes(filter.status)) and.push({ status: filter.status as ProductStatus });
  const clean = (v: string) => v.replace(/[%_\\]+/g, " ").replace(/\s+/g, " ").trim().slice(0, 100);
  const q = filter.q ? clean(filter.q) : "";
  if (q) and.push({ OR: [{ name: { contains: q, mode: "insensitive" } }, { slug: { contains: q, mode: "insensitive" } }] });
  const seller = filter.seller ? clean(filter.seller) : "";
  if (seller) and.push({ seller: { OR: [{ name: { contains: seller, mode: "insensitive" } }, { email: { contains: seller, mode: "insensitive" } }] } });
  if (filter.categoryId) and.push({ categoryId: filter.categoryId });
  if (filter.from || filter.to) and.push({ updatedAt: { ...(filter.from ? { gte: filter.from } : {}), ...(filter.to ? { lte: filter.to } : {}) } });
  return and.length ? { AND: and } : {};
}

export async function getListingDetail(productId: string) {
  const product = await db.product.findUnique({
    where: { id: productId },
    include: {
      seller: { select: { id: true, name: true, email: true, bannedAt: true } },
      category: { select: { id: true, name: true } },
      images: { orderBy: { position: "asc" }, take: 6 },
      _count: { select: { reviews: true, orderItems: true, licenses: true, subscriptions: true, downloads: true, versions: true } },
    },
  });
  if (!product) return null;
  const [history, blockers] = await Promise.all([
    db.auditLog.findMany({
      where: { entityType: "Product", entityId: productId },
      orderBy: { createdAt: "desc" },
      take: 20,
      include: { actor: { select: { name: true, email: true } } },
    }),
    listingDeleteBlockers(productId),
  ]);
  return { product, history, blockers };
}

/** Filtered, paginated listings for the admin products page. */
export async function listListings(filter: ListingFilter, page: number, pageSize: number) {
  const where = buildListingWhere(filter);
  const safePage = Math.max(1, Math.floor(page) || 1);
  const [items, total] = await Promise.all([
    db.product.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      skip: (safePage - 1) * pageSize,
      take: pageSize,
      include: {
        seller: { select: { id: true, name: true, email: true } },
        category: { select: { name: true } },
        images: { orderBy: { position: "asc" }, take: 1, select: { storageKey: true, altText: true } },
      },
    }),
    db.product.count({ where }),
  ]);
  return { items, total, page: safePage, pageSize };
}
