-- Partnership programme (Partners + Master Partners). Additive only: new
-- enums and tables plus one new NotificationType value. No existing table,
-- column or row is changed or removed.

-- CreateEnum
CREATE TYPE "PartnerStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "MasterPartnerStatus" AS ENUM ('NOT_APPLIED', 'PENDING', 'APPROVED', 'REJECTED', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "PartnerTier" AS ENUM ('PARTNER', 'MASTER_PARTNER');

-- CreateEnum
CREATE TYPE "PartnerCommissionStatus" AS ENUM ('PENDING', 'APPROVED', 'PAID', 'REVERSED', 'REJECTED');

-- CreateEnum
CREATE TYPE "PartnerPayoutStatus" AS ENUM ('REQUESTED', 'APPROVED', 'PAID', 'REJECTED');

-- CreateEnum
CREATE TYPE "ReferralSource" AS ENUM ('REGISTRATION', 'REFERRAL_LINK');

-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'PARTNERSHIP';

-- CreateTable
CREATE TABLE "partner_profiles" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "PartnerStatus" NOT NULL DEFAULT 'PENDING',
    "referralCode" VARCHAR(16),
    "applicationNote" TEXT,
    "appliedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decidedAt" TIMESTAMP(3),
    "decidedById" TEXT,
    "decisionReason" TEXT,
    "masterStatus" "MasterPartnerStatus" NOT NULL DEFAULT 'NOT_APPLIED',
    "masterCode" VARCHAR(16),
    "masterApplicationNote" TEXT,
    "masterAppliedAt" TIMESTAMP(3),
    "masterDecidedAt" TIMESTAMP(3),
    "masterDecidedById" TEXT,
    "masterDecisionReason" TEXT,
    "recruitedById" TEXT,
    "recruitedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "partner_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "referral_attributions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "partnerId" TEXT NOT NULL,
    "source" "ReferralSource" NOT NULL DEFAULT 'REGISTRATION',
    "clickedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "referral_attributions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "referral_clicks" (
    "id" TEXT NOT NULL,
    "partnerId" TEXT NOT NULL,
    "visitorKey" VARCHAR(64) NOT NULL,
    "day" DATE NOT NULL,
    "landingPath" VARCHAR(300) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "referral_clicks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_referrals" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "partnerId" TEXT NOT NULL,
    "source" "ReferralSource" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "order_referrals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "partner_commissions" (
    "id" TEXT NOT NULL,
    "beneficiaryId" TEXT NOT NULL,
    "beneficiaryTier" "PartnerTier" NOT NULL,
    "type" "PartnerTier" NOT NULL,
    "orderId" TEXT NOT NULL,
    "orderItemId" TEXT NOT NULL,
    "buyerId" TEXT NOT NULL,
    "referringPartnerId" TEXT NOT NULL,
    "masterPartnerId" TEXT,
    "rateBps" INTEGER NOT NULL,
    "basisCents" INTEGER NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL,
    "status" "PartnerCommissionStatus" NOT NULL DEFAULT 'PENDING',
    "holdUntil" TIMESTAMP(3) NOT NULL,
    "approvedAt" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "payoutId" TEXT,
    "reversedAt" TIMESTAMP(3),
    "statusReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "partner_commissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "partner_payouts" (
    "id" TEXT NOT NULL,
    "partnerId" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL,
    "method" VARCHAR(32) NOT NULL,
    "destination" VARCHAR(120) NOT NULL,
    "status" "PartnerPayoutStatus" NOT NULL DEFAULT 'REQUESTED',
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decidedAt" TIMESTAMP(3),
    "decidedById" TEXT,
    "rejectionReason" TEXT,
    "paidAt" TIMESTAMP(3),
    "paymentReference" VARCHAR(120),

    CONSTRAINT "partner_payouts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "partnership_settings" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "programmeOpen" BOOLEAN NOT NULL DEFAULT true,
    "partnerRateBps" INTEGER NOT NULL DEFAULT 2000,
    "masterRateBps" INTEGER NOT NULL DEFAULT 1000,
    "attributionDays" INTEGER NOT NULL DEFAULT 30,
    "referredUserCommissionDays" INTEGER NOT NULL DEFAULT 0,
    "holdDays" INTEGER NOT NULL DEFAULT 14,
    "minPayoutCents" INTEGER NOT NULL DEFAULT 5000,
    "currencies" TEXT[] DEFAULT ARRAY['USD']::TEXT[],
    "eligibleCategoryIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "payoutMethods" TEXT[] DEFAULT ARRAY['MPESA', 'BANK_TRANSFER']::TEXT[],
    "termsText" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "partnership_settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "partner_profiles_userId_key" ON "partner_profiles"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "partner_profiles_referralCode_key" ON "partner_profiles"("referralCode");

-- CreateIndex
CREATE UNIQUE INDEX "partner_profiles_masterCode_key" ON "partner_profiles"("masterCode");

-- CreateIndex
CREATE INDEX "partner_profiles_status_appliedAt_idx" ON "partner_profiles"("status", "appliedAt");

-- CreateIndex
CREATE INDEX "partner_profiles_masterStatus_masterAppliedAt_idx" ON "partner_profiles"("masterStatus", "masterAppliedAt");

-- CreateIndex
CREATE INDEX "partner_profiles_recruitedById_idx" ON "partner_profiles"("recruitedById");

-- CreateIndex
CREATE UNIQUE INDEX "referral_attributions_userId_key" ON "referral_attributions"("userId");

-- CreateIndex
CREATE INDEX "referral_attributions_partnerId_createdAt_idx" ON "referral_attributions"("partnerId", "createdAt");

-- CreateIndex
CREATE INDEX "referral_clicks_partnerId_createdAt_idx" ON "referral_clicks"("partnerId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "referral_clicks_partnerId_visitorKey_day_key" ON "referral_clicks"("partnerId", "visitorKey", "day");

-- CreateIndex
CREATE UNIQUE INDEX "order_referrals_orderId_key" ON "order_referrals"("orderId");

-- CreateIndex
CREATE INDEX "order_referrals_partnerId_createdAt_idx" ON "order_referrals"("partnerId", "createdAt");

-- CreateIndex
CREATE INDEX "partner_commissions_beneficiaryId_status_idx" ON "partner_commissions"("beneficiaryId", "status");

-- CreateIndex
CREATE INDEX "partner_commissions_status_holdUntil_idx" ON "partner_commissions"("status", "holdUntil");

-- CreateIndex
CREATE INDEX "partner_commissions_orderId_idx" ON "partner_commissions"("orderId");

-- CreateIndex
CREATE INDEX "partner_commissions_payoutId_idx" ON "partner_commissions"("payoutId");

-- CreateIndex
CREATE UNIQUE INDEX "partner_commissions_orderItemId_type_key" ON "partner_commissions"("orderItemId", "type");

-- CreateIndex
CREATE INDEX "partner_payouts_partnerId_status_idx" ON "partner_payouts"("partnerId", "status");

-- CreateIndex
CREATE INDEX "partner_payouts_status_requestedAt_idx" ON "partner_payouts"("status", "requestedAt");

-- AddForeignKey
ALTER TABLE "partner_profiles" ADD CONSTRAINT "partner_profiles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "partner_profiles" ADD CONSTRAINT "partner_profiles_recruitedById_fkey" FOREIGN KEY ("recruitedById") REFERENCES "partner_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "referral_attributions" ADD CONSTRAINT "referral_attributions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "referral_attributions" ADD CONSTRAINT "referral_attributions_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "partner_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "referral_clicks" ADD CONSTRAINT "referral_clicks_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "partner_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_referrals" ADD CONSTRAINT "order_referrals_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_referrals" ADD CONSTRAINT "order_referrals_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "partner_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "partner_commissions" ADD CONSTRAINT "partner_commissions_beneficiaryId_fkey" FOREIGN KEY ("beneficiaryId") REFERENCES "partner_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "partner_commissions" ADD CONSTRAINT "partner_commissions_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "partner_commissions" ADD CONSTRAINT "partner_commissions_orderItemId_fkey" FOREIGN KEY ("orderItemId") REFERENCES "order_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "partner_commissions" ADD CONSTRAINT "partner_commissions_payoutId_fkey" FOREIGN KEY ("payoutId") REFERENCES "partner_payouts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "partner_payouts" ADD CONSTRAINT "partner_payouts_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "partner_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
