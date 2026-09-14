import { db } from "@/lib/db";
import { createNotification } from "@/repositories/notification-repository";

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

  const verifiedPurchase = await hasPaidOrder(input.userId, input.productId);

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
