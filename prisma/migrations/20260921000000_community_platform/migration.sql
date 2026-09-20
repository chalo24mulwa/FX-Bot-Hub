-- CreateEnum
CREATE TYPE "CommunityPostType" AS ENUM ('DISCUSSION', 'TRADING_IDEA', 'SIGNAL', 'QUESTION', 'CHART');

-- CreateEnum
CREATE TYPE "TradeDirection" AS ENUM ('BUY', 'SELL', 'NEUTRAL');

-- CreateEnum
CREATE TYPE "CommunityContentStatus" AS ENUM ('PUBLISHED', 'HIDDEN', 'REMOVED');

-- CreateEnum
CREATE TYPE "CommunityReportReason" AS ENUM ('SPAM', 'SCAM', 'HARASSMENT', 'MISLEADING', 'INAPPROPRIATE', 'FAKE_CLAIM', 'OTHER');

-- CreateEnum
CREATE TYPE "CommunityReportStatus" AS ENUM ('OPEN', 'RESOLVED', 'DISMISSED');

-- CreateEnum
CREATE TYPE "CommunityRestrictionState" AS ENUM ('POSTING_SUSPENDED', 'COMMUNITY_SUSPENDED', 'BANNED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "NotificationType" ADD VALUE 'COMMUNITY_REPLY';
ALTER TYPE "NotificationType" ADD VALUE 'COMMUNITY_MENTION';
ALTER TYPE "NotificationType" ADD VALUE 'COMMUNITY_ACTIVITY';
ALTER TYPE "NotificationType" ADD VALUE 'COMMUNITY_MODERATION';

-- AlterTable
ALTER TABLE "profiles" ADD COLUMN     "username" VARCHAR(24);

-- CreateTable
CREATE TABLE "community_categories" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "community_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "community_posts" (
    "id" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "type" "CommunityPostType" NOT NULL DEFAULT 'DISCUSSION',
    "title" VARCHAR(180) NOT NULL,
    "content" TEXT NOT NULL,
    "instrument" VARCHAR(20),
    "direction" "TradeDirection",
    "timeframe" VARCHAR(8),
    "entryPrice" VARCHAR(24),
    "stopLoss" VARCHAR(24),
    "takeProfit" VARCHAR(24),
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "status" "CommunityContentStatus" NOT NULL DEFAULT 'PUBLISHED',
    "isPinned" BOOLEAN NOT NULL DEFAULT false,
    "isFeatured" BOOLEAN NOT NULL DEFAULT false,
    "isLocked" BOOLEAN NOT NULL DEFAULT false,
    "likeCount" INTEGER NOT NULL DEFAULT 0,
    "commentCount" INTEGER NOT NULL DEFAULT 0,
    "viewCount" INTEGER NOT NULL DEFAULT 0,
    "bookmarkCount" INTEGER NOT NULL DEFAULT 0,
    "moderationNote" TEXT,
    "moderatedById" TEXT,
    "moderatedAt" TIMESTAMP(3),
    "editedAt" TIMESTAMP(3),
    "lastActivityAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "community_posts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "community_comments" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "parentId" TEXT,
    "depth" INTEGER NOT NULL DEFAULT 0,
    "content" TEXT NOT NULL,
    "status" "CommunityContentStatus" NOT NULL DEFAULT 'PUBLISHED',
    "likeCount" INTEGER NOT NULL DEFAULT 0,
    "moderationNote" TEXT,
    "moderatedById" TEXT,
    "moderatedAt" TIMESTAMP(3),
    "editedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "community_comments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "community_post_votes" (
    "userId" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "community_post_votes_pkey" PRIMARY KEY ("userId","postId")
);

-- CreateTable
CREATE TABLE "community_comment_votes" (
    "userId" TEXT NOT NULL,
    "commentId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "community_comment_votes_pkey" PRIMARY KEY ("userId","commentId")
);

-- CreateTable
CREATE TABLE "community_bookmarks" (
    "userId" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "community_bookmarks_pkey" PRIMARY KEY ("userId","postId")
);

-- CreateTable
CREATE TABLE "community_post_follows" (
    "userId" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "community_post_follows_pkey" PRIMARY KEY ("userId","postId")
);

-- CreateTable
CREATE TABLE "community_attachments" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "community_attachments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "community_reports" (
    "id" TEXT NOT NULL,
    "reporterId" TEXT NOT NULL,
    "postId" TEXT,
    "commentId" TEXT,
    "reason" "CommunityReportReason" NOT NULL,
    "details" TEXT,
    "status" "CommunityReportStatus" NOT NULL DEFAULT 'OPEN',
    "resolvedById" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "resolutionNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "community_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "community_restrictions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "state" "CommunityRestrictionState" NOT NULL,
    "reason" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endsAt" TIMESTAMP(3),
    "issuedById" TEXT NOT NULL,
    "liftedAt" TIMESTAMP(3),
    "liftedById" TEXT,
    "liftNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "community_restrictions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "community_categories_slug_key" ON "community_categories"("slug");

-- CreateIndex
CREATE INDEX "community_categories_isActive_position_idx" ON "community_categories"("isActive", "position");

-- CreateIndex
CREATE INDEX "community_posts_status_createdAt_idx" ON "community_posts"("status", "createdAt");

-- CreateIndex
CREATE INDEX "community_posts_categoryId_status_createdAt_idx" ON "community_posts"("categoryId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "community_posts_authorId_createdAt_idx" ON "community_posts"("authorId", "createdAt");

-- CreateIndex
CREATE INDEX "community_posts_type_status_createdAt_idx" ON "community_posts"("type", "status", "createdAt");

-- CreateIndex
CREATE INDEX "community_posts_instrument_idx" ON "community_posts"("instrument");

-- CreateIndex
CREATE INDEX "community_posts_status_likeCount_idx" ON "community_posts"("status", "likeCount");

-- CreateIndex
CREATE INDEX "community_posts_status_commentCount_idx" ON "community_posts"("status", "commentCount");

-- CreateIndex
CREATE INDEX "community_posts_isPinned_isFeatured_idx" ON "community_posts"("isPinned", "isFeatured");

-- CreateIndex
CREATE INDEX "community_posts_tags_idx" ON "community_posts" USING GIN ("tags");

-- CreateIndex
CREATE INDEX "community_comments_postId_createdAt_idx" ON "community_comments"("postId", "createdAt");

-- CreateIndex
CREATE INDEX "community_comments_authorId_createdAt_idx" ON "community_comments"("authorId", "createdAt");

-- CreateIndex
CREATE INDEX "community_comments_parentId_idx" ON "community_comments"("parentId");

-- CreateIndex
CREATE INDEX "community_post_votes_postId_idx" ON "community_post_votes"("postId");

-- CreateIndex
CREATE INDEX "community_comment_votes_commentId_idx" ON "community_comment_votes"("commentId");

-- CreateIndex
CREATE INDEX "community_bookmarks_userId_createdAt_idx" ON "community_bookmarks"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "community_post_follows_postId_idx" ON "community_post_follows"("postId");

-- CreateIndex
CREATE INDEX "community_attachments_postId_position_idx" ON "community_attachments"("postId", "position");

-- CreateIndex
CREATE INDEX "community_reports_status_createdAt_idx" ON "community_reports"("status", "createdAt");

-- CreateIndex
CREATE INDEX "community_reports_postId_idx" ON "community_reports"("postId");

-- CreateIndex
CREATE INDEX "community_reports_commentId_idx" ON "community_reports"("commentId");

-- CreateIndex
CREATE UNIQUE INDEX "community_reports_reporterId_postId_key" ON "community_reports"("reporterId", "postId");

-- CreateIndex
CREATE UNIQUE INDEX "community_reports_reporterId_commentId_key" ON "community_reports"("reporterId", "commentId");

-- CreateIndex
CREATE INDEX "community_restrictions_userId_liftedAt_idx" ON "community_restrictions"("userId", "liftedAt");

-- CreateIndex
CREATE INDEX "community_restrictions_state_liftedAt_idx" ON "community_restrictions"("state", "liftedAt");

-- CreateIndex
CREATE UNIQUE INDEX "profiles_username_key" ON "profiles"("username");

-- AddForeignKey
ALTER TABLE "community_posts" ADD CONSTRAINT "community_posts_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "community_posts" ADD CONSTRAINT "community_posts_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "community_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "community_comments" ADD CONSTRAINT "community_comments_postId_fkey" FOREIGN KEY ("postId") REFERENCES "community_posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "community_comments" ADD CONSTRAINT "community_comments_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "community_comments" ADD CONSTRAINT "community_comments_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "community_comments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "community_post_votes" ADD CONSTRAINT "community_post_votes_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "community_post_votes" ADD CONSTRAINT "community_post_votes_postId_fkey" FOREIGN KEY ("postId") REFERENCES "community_posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "community_comment_votes" ADD CONSTRAINT "community_comment_votes_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "community_comment_votes" ADD CONSTRAINT "community_comment_votes_commentId_fkey" FOREIGN KEY ("commentId") REFERENCES "community_comments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "community_bookmarks" ADD CONSTRAINT "community_bookmarks_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "community_bookmarks" ADD CONSTRAINT "community_bookmarks_postId_fkey" FOREIGN KEY ("postId") REFERENCES "community_posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "community_post_follows" ADD CONSTRAINT "community_post_follows_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "community_post_follows" ADD CONSTRAINT "community_post_follows_postId_fkey" FOREIGN KEY ("postId") REFERENCES "community_posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "community_attachments" ADD CONSTRAINT "community_attachments_postId_fkey" FOREIGN KEY ("postId") REFERENCES "community_posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "community_reports" ADD CONSTRAINT "community_reports_reporterId_fkey" FOREIGN KEY ("reporterId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "community_reports" ADD CONSTRAINT "community_reports_postId_fkey" FOREIGN KEY ("postId") REFERENCES "community_posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "community_reports" ADD CONSTRAINT "community_reports_commentId_fkey" FOREIGN KEY ("commentId") REFERENCES "community_comments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "community_restrictions" ADD CONSTRAINT "community_restrictions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "community_restrictions" ADD CONSTRAINT "community_restrictions_issuedById_fkey" FOREIGN KEY ("issuedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Launch categories. Admin-managed afterwards (/admin/community/categories),
-- so this only seeds a fresh database; ON CONFLICT keeps it re-runnable.
INSERT INTO "community_categories" ("id", "slug", "name", "description", "position", "isActive", "updatedAt") VALUES
  ('cc_forex_trading',        'forex-trading',        'Forex Trading',        'General forex trading talk, setups and experiences.', 1, true, CURRENT_TIMESTAMP),
  ('cc_mt4',                  'mt4',                  'MT4',                  'MetaTrader 4 platform, EAs, indicators and troubleshooting.', 2, true, CURRENT_TIMESTAMP),
  ('cc_mt5',                  'mt5',                  'MT5',                  'MetaTrader 5 platform, EAs, indicators and troubleshooting.', 3, true, CURRENT_TIMESTAMP),
  ('cc_expert_advisors',      'expert-advisors',      'Expert Advisors',      'Automated trading: building, testing and running EAs and bots.', 4, true, CURRENT_TIMESTAMP),
  ('cc_indicators',           'indicators',           'Indicators',           'Custom and built-in indicators and how to use them.', 5, true, CURRENT_TIMESTAMP),
  ('cc_trading_signals',      'trading-signals',      'Trading Signals',      'Trade setups and signals shared by members.', 6, true, CURRENT_TIMESTAMP),
  ('cc_technical_analysis',   'technical-analysis',   'Technical Analysis',   'Charts, patterns, levels and price-action analysis.', 7, true, CURRENT_TIMESTAMP),
  ('cc_fundamental_analysis', 'fundamental-analysis', 'Fundamental Analysis', 'Macro, central banks, rates and economic drivers.', 8, true, CURRENT_TIMESTAMP),
  ('cc_economic_calendar',    'economic-calendar',    'Economic Calendar',    'Discussing releases, events and how to trade around them.', 9, true, CURRENT_TIMESTAMP),
  ('cc_market_news',          'market-news',          'Market News',          'Headlines and market-moving news.', 10, true, CURRENT_TIMESTAMP),
  ('cc_trading_strategies',   'trading-strategies',   'Trading Strategies',   'Strategy design, backtesting and refinement.', 11, true, CURRENT_TIMESTAMP),
  ('cc_risk_management',      'risk-management',      'Risk Management',      'Position sizing, drawdown control and trading psychology.', 12, true, CURRENT_TIMESTAMP),
  ('cc_beginners',            'beginners',            'Beginners',            'New to forex? Ask anything here.', 13, true, CURRENT_TIMESTAMP),
  ('cc_general_discussion',   'general-discussion',   'General Discussion',   'Everything else.', 14, true, CURRENT_TIMESTAMP)
ON CONFLICT ("slug") DO NOTHING;
