import { db } from "@/lib/db";
import { createNotification } from "@/repositories/notification-repository";
import { invalidateProductCaches } from "@/lib/product-cache";

export class ReviewError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

async function hasPaidOrder(userId: string, productId: string): Promise<boolean> {
  const item = await db.orderItem.findFirst({
    where: { productId, order: { userId, status: "PAID" } },
    select: { id: true },
  });
  return item !== null;
}

/**
 * Who may rate a product: a verified purchaser — someone with a PAID order for it (free products settle as $0 PAID orders, so
 * "Get for free" counts) or a licence — and never the product's own seller. Reviews written before this rule stay as they are.
 */
export async function canReviewProduct(
  userId: string,
  productId: string,
  knownSellerId?: string // the product page already has it: one round trip fewer
): Promise<{ allowed: boolean; reason?: "owner" | "not_purchased" }> {
  const sellerId = knownSellerId ?? (await db.product.findUnique({ where: { id: productId }, select: { sellerId: true } }))?.sellerId;
  if (!sellerId) return { allowed: false, reason: "not_purchased" };
  if (sellerId === userId) return { allowed: false, reason: "owner" };
  // The order and the licence checks are independent: ask both at once.
  const [paid, license] = await Promise.all([hasPaidOrder(userId, productId), db.license.findFirst({ where: { userId, productId }, select: { id: true } })]);
  return paid || license ? { allowed: true } : { allowed: false, reason: "not_purchased" };
}

/** Recomputes the materialized ProductRatingSummary from Review + ProductRating
 * rows. Called after any write to either — cheap enough at this scale
 * (single grouped aggregate query), and keeps reads (product cards, list
 * pages) from ever having to aggregate on the fly. */
export async function recomputeRatingSummary(productId: string) {
  const [reviews, ratings] = await Promise.all([
    db.review.findMany({ where: { productId, hidden: false }, select: { userId: true, rating: true } }),
    db.productRating.findMany({ where: { productId }, select: { userId: true, rating: true } }),
  ]);

  // A user's review rating takes precedence over a standalone quick-rating
  // for the same product, so each user counts once.
  const byUser = new Map<string, number>();
  for (const r of ratings) byUser.set(r.userId, r.rating);
  for (const r of reviews) byUser.set(r.userId, r.rating);

  const values = [...byUser.values()];
  const count = values.length;
  const average = count === 0 ? 0 : values.reduce((a, b) => a + b, 0) / count;
  const stars = [1, 2, 3, 4, 5].map((star) => values.filter((v) => v === star).length);

  await db.productRatingSummary.upsert({
    where: { productId },
    update: { average, count, star1: stars[0], star2: stars[1], star3: stars[2], star4: stars[3], star5: stars[4] },
    create: {
      productId,
      average,
      count,
      star1: stars[0],
      star2: stars[1],
      star3: stars[2],
      star4: stars[3],
      star5: stars[4],
    },
  });
  // After the write, so nobody can re-cache the old numbers in between.
  invalidateProductCaches();
}

export interface SubmitReviewInput {
  productId: string;
  userId: string;
  rating: number;
  title?: string;
  body?: string;
}

export async function submitReview(input: SubmitReviewInput) {
  const product = await db.product.findUnique({ where: { id: input.productId }, select: { name: true, sellerId: true, slug: true } });
  if (!product) throw new ReviewError("Product not found.", 404);

  if (!Number.isInteger(input.rating) || input.rating < 1 || input.rating > 5) throw new ReviewError("Choose a rating from 1 to 5 stars.", 422);
  const permission = await canReviewProduct(input.userId, input.productId);
  if (!permission.allowed) {
    throw new ReviewError(
      permission.reason === "owner" ? "You can't rate your own product." : "Only customers who bought or got this product can rate it.",
      403,
    );
  }
  const verifiedPurchase = true; // guaranteed by the check above

  const review = await db.review.upsert({
    where: { productId_userId: { productId: input.productId, userId: input.userId } },
    update: { rating: input.rating, title: input.title, body: input.body, verifiedPurchase },
    create: {
      productId: input.productId,
      userId: input.userId,
      rating: input.rating,
      title: input.title,
      body: input.body,
      verifiedPurchase,
    },
  });

  await recomputeRatingSummary(input.productId);

  void createNotification({
    userId: product.sellerId,
    type: "REVIEW_RECEIVED",
    title: `New review on "${product.name}"`,
    body: input.body?.slice(0, 140),
    link: `/marketplace/${product.slug}#reviews`,
  });

  return review;
}

export async function respondToReview(sellerId: string, reviewId: string, response: string) {
  const review = await db.review.findUnique({ where: { id: reviewId }, include: { product: true } });
  if (!review || review.product.sellerId !== sellerId) {
    throw new ReviewError("Review not found.", 404);
  }

  return db.review.update({
    where: { id: reviewId },
    data: { sellerResponse: response, sellerRespondedAt: new Date() },
  });
}

export async function setReviewHidden(reviewId: string, hidden: boolean) {
  const review = await db.review.update({ where: { id: reviewId }, data: { hidden } });
  await recomputeRatingSummary(review.productId);
  return review;
}

export async function deleteReview(reviewId: string) {
  const review = await db.review.delete({ where: { id: reviewId } });
  await recomputeRatingSummary(review.productId);
  return review;
}
