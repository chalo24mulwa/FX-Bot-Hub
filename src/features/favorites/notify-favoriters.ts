import { db } from "@/lib/db";
import { createNotification } from "@/repositories/notification-repository";
import { enqueueEmail } from "@/jobs/send-email";
import { buildPriceChangeEmail, buildNewVersionEmail } from "@/emails/templates";
import type { NotificationType } from "@prisma/client";

const siteUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

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
  });

  for (const fav of favorites) {
    void createNotification({ userId: fav.userId, type, title, body, link: `/marketplace` });
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
