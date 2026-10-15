-- CreateEnum
CREATE TYPE "VpsStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- CreateTable
CREATE TABLE "vps_providers" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "VpsStatus" NOT NULL DEFAULT 'DRAFT',
    "position" INTEGER NOT NULL DEFAULT 0,
    "featured" BOOLEAN NOT NULL DEFAULT false,
    "sponsored" BOOLEAN NOT NULL DEFAULT false,
    "disclosureNote" VARCHAR(160),
    "officialUrl" TEXT NOT NULL,
    "affiliateUrl" TEXT,
    "ctaLabel" VARCHAR(30),
    "promoCode" VARCHAR(40),
    "offerText" VARCHAR(240),
    "offerExpiresAt" DATE,
    "logoData" BYTEA,
    "logoMime" VARCHAR(40),
    "logoUpdatedAt" TIMESTAMP(3),
    "coverData" BYTEA,
    "coverMime" VARCHAR(40),
    "coverUpdatedAt" TIMESTAMP(3),
    "category" VARCHAR(60),
    "headline" VARCHAR(160),
    "description" TEXT NOT NULL DEFAULT '',
    "features" TEXT[],
    "bestFor" TEXT[],
    "operatingSystems" TEXT[],
    "serverLocations" TEXT[],
    "platforms" TEXT[],
    "cpu" VARCHAR(120),
    "ram" VARCHAR(120),
    "storage" VARCHAR(120),
    "otherSpecs" VARCHAR(400),
    "priceCents" INTEGER,
    "priceCurrency" VARCHAR(3),
    "pricePeriod" VARCHAR(5),
    "freeTrial" BOOLEAN NOT NULL DEFAULT false,
    "trialNote" VARCHAR(240),
    "latencyInfo" VARCHAR(400),
    "latencySource" VARCHAR(300),
    "whyRecommend" TEXT NOT NULL DEFAULT '',
    "advantages" TEXT[],
    "limitations" TEXT[],
    "rating" DOUBLE PRECISION,
    "ratingNote" VARCHAR(300),
    "seoTitle" VARCHAR(70),
    "seoDescription" VARCHAR(160),
    "infoVerifiedAt" DATE,
    "publishedAt" TIMESTAMP(3),
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vps_providers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "vps_providers_slug_key" ON "vps_providers"("slug");

-- CreateIndex
CREATE INDEX "vps_providers_status_position_idx" ON "vps_providers"("status", "position");

