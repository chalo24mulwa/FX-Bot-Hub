-- CreateEnum
CREATE TYPE "AssetClass" AS ENUM ('FOREX', 'METAL', 'COMMODITY', 'STOCK', 'INDEX', 'OTHER');

-- CreateTable
CREATE TABLE "instruments" (
    "id" TEXT NOT NULL,
    "providerKey" TEXT NOT NULL,
    "externalSymbol" TEXT NOT NULL,
    "displaySymbol" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "assetClass" "AssetClass" NOT NULL,
    "exchange" TEXT,
    "currency" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "lastSyncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "instruments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "instruments_assetClass_idx" ON "instruments"("assetClass");

-- CreateIndex
CREATE INDEX "instruments_displaySymbol_idx" ON "instruments"("displaySymbol");

-- CreateIndex
CREATE UNIQUE INDEX "instruments_providerKey_externalSymbol_key" ON "instruments"("providerKey", "externalSymbol");
