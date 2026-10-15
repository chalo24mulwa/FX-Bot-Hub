-- CreateEnum
CREATE TYPE "BrokerStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- CreateTable
CREATE TABLE "brokers" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "BrokerStatus" NOT NULL DEFAULT 'DRAFT',
    "position" INTEGER NOT NULL DEFAULT 0,
    "featured" BOOLEAN NOT NULL DEFAULT false,
    "officialUrl" TEXT NOT NULL,
    "affiliateUrl" TEXT,
    "sponsored" BOOLEAN NOT NULL DEFAULT false,
    "logoData" BYTEA,
    "logoMime" VARCHAR(40),
    "logoUpdatedAt" TIMESTAMP(3),
    "tagline" VARCHAR(160),
    "features" TEXT[],
    "whySelected" TEXT NOT NULL DEFAULT '',
    "bestFor" TEXT[],
    "platforms" TEXT[],
    "instruments" VARCHAR(400),
    "accountTypes" VARCHAR(400),
    "minDeposit" VARCHAR(120),
    "spreadsInfo" VARCHAR(400),
    "regulation" VARCHAR(600),
    "rating" DOUBLE PRECISION,
    "ratingNote" VARCHAR(300),
    "infoVerifiedAt" DATE,
    "publishedAt" TIMESTAMP(3),
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "brokers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "brokers_slug_key" ON "brokers"("slug");

-- CreateIndex
CREATE INDEX "brokers_status_position_idx" ON "brokers"("status", "position");

