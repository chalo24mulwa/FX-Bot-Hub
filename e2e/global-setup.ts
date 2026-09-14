import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

// Runs once before the Playwright suite (see playwright.config.ts's
// globalSetup) against whatever DATABASE_URL the test run points at — CI's
// ephemeral Postgres service included. Deliberately does not depend on
// prisma/seed.ts (that's for local dev demo data); this creates only the
// fixed-credential accounts the e2e specs log in as.
export default async function globalSetup() {
  const db = new PrismaClient();
  const password = await bcrypt.hash("password123", 12);

  async function upsertUser(email: string, name: string, role: "USER" | "SELLER" | "SUPER_ADMIN") {
    return db.user.upsert({
      where: { email },
      update: { role },
      create: { email, name, password, role, profile: { create: { displayName: name } } },
    });
  }

  await upsertUser("e2e-buyer@fxbotmarket.local", "E2E Buyer", "USER");
  const seller = await upsertUser("e2e-seller@fxbotmarket.local", "E2E Seller", "SELLER");
  await upsertUser("e2e-admin@fxbotmarket.local", "E2E Admin", "SUPER_ADMIN");

  await db.sellerProfile.upsert({
    where: { userId: seller.id },
    update: {},
    create: { userId: seller.id, displayName: "E2E Seller" },
  });

  await db.productCategory.upsert({
    where: { slug: "e2e-category" },
    update: {},
    create: { name: "E2E Category", slug: "e2e-category" },
  });

  // A published FREE product so checkout/entitlement/review specs don't
  // each need to build one from scratch through the moderation queue.
  await db.product.upsert({
    where: { slug: "e2e-free-product" },
    update: { status: "PUBLISHED", publishedAt: new Date() },
    create: {
      slug: "e2e-free-product",
      sellerId: seller.id,
      name: "E2E Free Product",
      type: "EA",
      platform: "MT5",
      pricingType: "FREE",
      priceCents: 0,
      currency: "USD",
      status: "PUBLISHED",
      publishedAt: new Date(),
      shortSummary: "A free product used by end-to-end tests.",
      description: "Seeded for Playwright — safe to leave in the database.",
    },
  });

  await db.$disconnect();
}
