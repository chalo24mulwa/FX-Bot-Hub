import { db } from "@/lib/db";
import { enqueueEmail } from "@/jobs/send-email";
import { buildPriceChangeEmail, buildNewVersionEmail } from "@/emails/templates";
import type { NotificationType } from "@prisma/client";

const siteUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
// Phase 5: this had no cap at all — a very popular product's favoriter list
// could grow unbounded (docs/PHASE5_AUDIT.md). 5,000 is generous relative to
// any single product's realistic favorite count today; a product that
// actually hits this needs a real fan-out job queue, not a higher constant.
const MAX_FAVORITERS_NOTIFIED = 5_000;

async function notifyFavoriters(
  productId: string,
  type: NotificationType,
  title: string,
  body: string,
  buildEmail: (email: string) => Promise<void> | void
) {
  const favorites = await db.favorite.findMany({
    where: { productId },
    select: { userId: true, user: { select: { email: true } } },
    take: MAX_FAVORITERS_NOTIFIED,
  });
  if (favorites.length === 0) return;

  // One batched insert instead of N — emails still go out per-recipient
  // (each queued individually into BullMQ, which handles its own
  // concurrency) since there's no batch email API to batch them into.
  await db.notification.createMany({
    data: favorites.map((fav) => ({ userId: fav.userId, type, title, body, link: "/marketplace" })),
  });
  for (const fav of favorites) {
    void buildEmail(fav.user.email);
  }
}

export async function notifyPriceChange(productId: string, productName: string, slug: string, newPriceLabel: string) {
  await notifyFavoriters(
    productId,
    "PRICE_CHANGE",
    `Price update: "${productName}"`,
    `Now ${newPriceLabel}.`,
    (email) => enqueueEmail(email, buildPriceChangeEmail(productName, `${siteUrl}/marketplace/${slug}`, newPriceLabel))
  );
}

export async function notifyNewVersion(productId: string, productName: string, slug: string, version: string) {
  await notifyFavoriters(
    productId,
    "NEW_VERSION",
    `New version of "${productName}"`,
    `Version ${version} is now available.`,
    (email) => enqueueEmail(email, buildNewVersionEmail(productName, version, `${siteUrl}/marketplace/${slug}`))
  );
}
