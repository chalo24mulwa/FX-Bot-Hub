-- DropForeignKey
ALTER TABLE "alerts" DROP CONSTRAINT "alerts_economicEventId_fkey";

-- DropForeignKey
ALTER TABLE "alerts" DROP CONSTRAINT "alerts_newsArticleId_fkey";

-- AlterTable
ALTER TABLE "alerts" DROP COLUMN "economicEventId",
DROP COLUMN "newsArticleId",
ALTER COLUMN "targetId" SET NOT NULL;

