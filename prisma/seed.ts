import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const db = new PrismaClient();

async function upsertUser(email: string, name: string, role: "USER" | "SELLER" | "ADMIN" | "SUPER_ADMIN") {
  const password = await bcrypt.hash("password123", 12);
  return db.user.upsert({
    where: { email },
    update: {},
    create: {
      name,
      email,
      password,
      role,
      profile: { create: { displayName: name } },
    },
  });
}

async function main() {
  const [trendFollowing, scalping, indicators] = await Promise.all([
    db.productCategory.upsert({
      where: { slug: "trend-following" },
      update: {},
      create: { name: "Trend Following", slug: "trend-following" },
    }),
    db.productCategory.upsert({
      where: { slug: "scalping" },
      update: {},
      create: { name: "Scalping", slug: "scalping" },
    }),
    db.productCategory.upsert({
      where: { slug: "indicators" },
      update: {},
      create: { name: "Indicators", slug: "indicators" },
    }),
  ]);

  const vendor = await upsertUser("vendor@fxbotmarket.local", "Demo Vendor", "SELLER");
  await db.sellerProfile.upsert({
    where: { userId: vendor.id },
    update: {},
    create: {
      userId: vendor.id,
      displayName: "Demo Vendor",
      bio: "Building EAs since 2018.",
      verified: true,
    },
  });

  await upsertUser("buyer@fxbotmarket.local", "Demo Buyer", "USER");
  await upsertUser("moderator@fxbotmarket.local", "Demo Moderator", "ADMIN");
  await upsertUser("admin@fxbotmarket.local", "Demo Admin", "SUPER_ADMIN");

  const products = [
    {
      slug: "trend-rider-ea",
      categoryId: trendFollowing.id,
      name: "Trend Rider EA",
      type: "EA" as const,
      platform: "MT5" as const,
      pricingType: "ONE_TIME" as const,
      priceCents: 4900,
      featured: true,
      tags: ["trend", "ema", "risk-management"],
      shortSummary: "A moving-average crossover EA with adaptive risk sizing.",
      description:
        "Trend Rider EA trades EMA crossovers on major pairs, with configurable risk per trade, a trailing stop, and a news-time filter you can wire to the economic calendar.",
    },
    {
      slug: "scalp-master-mt4",
      categoryId: scalping.id,
      name: "Scalp Master MT4",
      type: "EA" as const,
      platform: "MT4" as const,
      pricingType: "SUBSCRIPTION" as const,
      priceCents: 1900,
      featured: true,
      tags: ["scalping", "m1", "m5"],
      shortSummary: "High-frequency scalping EA tuned for low-spread brokers.",
      description:
        "Scalp Master MT4 targets 5-15 pip moves on M1/M5 timeframes with tight spread and slippage guards.",
    },
    {
      slug: "supertrend-plus",
      categoryId: indicators.id,
      name: "SuperTrend Plus",
      type: "INDICATOR" as const,
      platform: "MULTI_PLATFORM" as const,
      pricingType: "FREE" as const,
      priceCents: 0,
      featured: false,
      tags: ["trend", "free"],
      shortSummary: "An enhanced SuperTrend indicator with multi-timeframe confirmation.",
      description: "SuperTrend Plus overlays multi-timeframe trend direction with alerting.",
    },
    {
      slug: "daily-fx-signals",
      categoryId: null,
      name: "Daily FX Signals",
      type: "SIGNAL" as const,
      platform: "MULTI_PLATFORM" as const,
      pricingType: "SUBSCRIPTION" as const,
      priceCents: 2900,
      featured: false,
      tags: ["signals", "daily"],
      shortSummary: "Manually curated daily trade signals for major pairs.",
      description: "Daily FX Signals delivers 2-4 vetted trade ideas per day with entry, SL, and TP.",
    },
  ];

  for (const p of products) {
    await db.product.upsert({
      where: { slug: p.slug },
      update: {},
      create: {
        ...p,
        sellerId: vendor.id,
        currency: "USD",
        status: "PUBLISHED",
        publishedAt: new Date(),
      },
    });
  }

  await db.economicEvent.upsert({
    where: { externalId: "seed-nfp" },
    update: {},
    create: {
      externalId: "seed-nfp",
      country: "United States",
      currency: "USD",
      title: "Non-Farm Payrolls",
      impact: "HIGH",
      category: "EMPLOYMENT",
      eventTime: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
      forecast: "180K",
      previous: "165K",
      source: "manual",
    },
  });

  // Phase 3: one enabled manual DataSource per kind, so /admin/data-sources
  // has something to show/toggle out of the box.
  await Promise.all([
    db.dataSource.upsert({
      where: { kind_providerKey: { kind: "CALENDAR", providerKey: "manual" } },
      update: {},
      create: { name: "Manual calendar", kind: "CALENDAR", providerKey: "manual", enabled: true },
    }),
    db.dataSource.upsert({
      where: { kind_providerKey: { kind: "NEWS", providerKey: "manual" } },
      update: {},
      create: { name: "Manual news", kind: "NEWS", providerKey: "manual", enabled: true },
    }),
  ]);

  const centralBanks = await db.newsCategory.upsert({
    where: { slug: "central-banks" },
    update: {},
    create: { name: "Central Banks", slug: "central-banks" },
  });

  await db.newsArticle.upsert({
    where: { slug: "fed-holds-rates-steady" },
    update: {},
    create: {
      slug: "fed-holds-rates-steady",
      title: "Fed holds rates steady, signals data-dependent path ahead",
      summary:
        "The Federal Reserve kept its benchmark rate unchanged, with the chair reiterating that future moves depend on incoming inflation and employment data.",
      sourceName: "Demo Wire Service",
      sourceUrl: "https://example.com/fed-holds-rates-steady",
      currency: "USD",
      categoryId: centralBanks.id,
      breaking: false,
      status: "PUBLISHED",
      publishedAt: new Date(),
    },
  });

  const signalProvider = await db.signalProviderProfile.upsert({
    where: { slug: "demo-signals-desk" },
    update: {},
    create: {
      userId: vendor.id,
      slug: "demo-signals-desk",
      displayName: "Demo Signals Desk",
      bio: "Illustrative signal provider for local development.",
      tradingStyle: "Swing trading, H4/D1",
      markets: ["EURUSD", "GBPUSD", "XAUUSD"],
      pricingType: "FREE",
      verified: true,
    },
  });

  await db.signal.upsert({
    where: { id: "seed-signal-eurusd" },
    update: {},
    create: {
      id: "seed-signal-eurusd",
      providerId: signalProvider.id,
      instrument: "EURUSD",
      direction: "BUY",
      status: "ACTIVE",
      timeframe: "H4",
      entryZoneLow: 1.085,
      entryZoneHigh: 1.088,
      stopLoss: 1.08,
      takeProfit: [1.095, 1.1],
      reasonMarkdown: "Illustrative signal seeded for local development.",
    },
  });

  console.log("Seed complete. Logins (password: password123):");
  console.log("  vendor@fxbotmarket.local     (SELLER)");
  console.log("  buyer@fxbotmarket.local      (USER)");
  console.log("  moderator@fxbotmarket.local  (ADMIN)");
  console.log("  admin@fxbotmarket.local      (SUPER_ADMIN)");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
