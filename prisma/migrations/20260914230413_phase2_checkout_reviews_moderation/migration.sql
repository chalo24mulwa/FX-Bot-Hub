/*
  Warnings:

  - Added the required column `updatedAt` to the `reviews` table without a default value. This is not possible if the table is not empty.

*/
-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "NotificationType" ADD VALUE 'PRICE_CHANGE';
ALTER TYPE "NotificationType" ADD VALUE 'NEW_VERSION';
ALTER TYPE "NotificationType" ADD VALUE 'PRODUCT_UPDATE';

-- AlterEnum
ALTER TYPE "ProductStatus" ADD VALUE 'UNDER_REVIEW';

-- AlterTable
ALTER TABLE "licenses" ADD COLUMN     "orderId" TEXT;

-- AlterTable
ALTER TABLE "products" ADD COLUMN     "assignedModeratorId" TEXT,
ADD COLUMN     "compatibilityNotes" TEXT,
ADD COLUMN     "features" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "installationInstructions" TEXT,
ADD COLUMN     "rejectionReason" TEXT,
ADD COLUMN     "requirements" TEXT,
ADD COLUMN     "supportInfo" TEXT,
ADD COLUMN     "viewCount" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "reviews" ADD COLUMN     "hidden" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "sellerRespondedAt" TIMESTAMP(3),
ADD COLUMN     "sellerResponse" TEXT,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "verifiedPurchase" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "carts" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "carts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cart_items" (
    "id" TEXT NOT NULL,
    "cartId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cart_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "marketplace_settings" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "commissionPercent" DOUBLE PRECISION NOT NULL DEFAULT 20,
    "rankingWeights" JSONB NOT NULL DEFAULT '{"sales":3,"downloads":1,"reviews":1,"rating":2,"recency":1,"favorites":1}',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "marketplace_settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "carts_userId_key" ON "carts"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "cart_items_cartId_productId_key" ON "cart_items"("cartId", "productId");

-- CreateIndex
CREATE INDEX "products_assignedModeratorId_idx" ON "products"("assignedModeratorId");

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_assignedModeratorId_fkey" FOREIGN KEY ("assignedModeratorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "carts" ADD CONSTRAINT "carts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cart_items" ADD CONSTRAINT "cart_items_cartId_fkey" FOREIGN KEY ("cartId") REFERENCES "carts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cart_items" ADD CONSTRAINT "cart_items_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "licenses" ADD CONSTRAINT "licenses_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;
