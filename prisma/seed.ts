import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const db = new PrismaClient();

async function main() {
  const category = await db.category.upsert({
    where: { slug: "trend-following" },
    update: {},
    create: { name: "Trend Following", slug: "trend-following" },
  });

  const passwordHash = await bcrypt.hash("password123", 12);
  const vendor = await db.user.upsert({
    where: { email: "vendor@fxbotmarket.local" },
    update: {},
    create: {
      name: "Demo Vendor",
      email: "vendor@fxbotmarket.local",
      password: passwordHash,
      role: "SELLER",
    },
  });

  await db.product.upsert({
    where: { slug: "trend-rider-ea" },
    update: {},
    create: {
      slug: "trend-rider-ea",
      vendorId: vendor.id,
      categoryId: category.id,
      name: "Trend Rider EA",
      type: "EXPERT_ADVISOR",
      platform: "MT5",
      shortSummary: "A moving-average crossover EA with adaptive risk sizing.",
      description:
        "Trend Rider EA trades EMA crossovers on major pairs, with configurable risk per trade, a trailing stop, and a news-time filter you can wire to the economic calendar.",
      priceCents: 4900,
      currency: "USD",
      status: "PUBLISHED",
      publishedAt: new Date(),
    },
  });

  await db.economicEvent.upsert({
    where: { externalId: "seed-nfp" },
    update: {},
    create: {
      externalId: "seed-nfp",
      country: "United States",
      currency: "USD",
      title: "Non-Farm Payrolls",
      impact: "HIGH",
      eventTime: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
      forecast: "180K",
      previous: "165K",
      source: "manual",
    },
  });

  console.log("Seed complete. Vendor login: vendor@fxbotmarket.local / password123");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
