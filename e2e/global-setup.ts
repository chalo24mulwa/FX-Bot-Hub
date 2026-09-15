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

  // Phase 3 fixtures: one economic event, one published news article + its
  // category, and one enabled manual calendar DataSource — enough for the
  // calendar/news specs to have something to render without depending on
  // the (Redis-backed, not run in CI) sync workers.
  await db.economicEvent.upsert({
    where: { externalId: "e2e-fixture-event" },
    update: {},
    create: {
      externalId: "e2e-fixture-event",
      country: "United States",
      currency: "USD",
      title: "E2E Fixture Event",
      impact: "HIGH",
      category: "CENTRAL_BANK",
      eventTime: new Date(Date.now() + 3 * 86_400_000),
      forecast: "1.0%",
      previous: "0.9%",
      source: "manual",
    },
  });

  const category = await db.newsCategory.upsert({
    where: { slug: "e2e-news-category" },
    update: {},
    create: { name: "E2E News Category", slug: "e2e-news-category" },
  });

  await db.newsArticle.upsert({
    where: { slug: "e2e-fixture-article" },
    update: { status: "PUBLISHED", publishedAt: new Date() },
    create: {
      slug: "e2e-fixture-article",
      title: "E2E Fixture Article",
      summary: "Seeded for Playwright — safe to leave in the database.",
      sourceName: "E2E Wire",
      sourceUrl: "https://example.com/e2e-fixture-article",
      currency: "USD",
      categoryId: category.id,
      status: "PUBLISHED",
      publishedAt: new Date(),
    },
  });

  await db.dataSource.upsert({
    where: { kind_providerKey: { kind: "CALENDAR", providerKey: "manual" } },
    update: {},
    create: { name: "Manual calendar (e2e)", kind: "CALENDAR", providerKey: "manual", enabled: true },
  });

  await db.$disconnect();
}
