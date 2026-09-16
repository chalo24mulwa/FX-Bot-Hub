-- CreateEnum
CREATE TYPE "EconomicEventStatus" AS ENUM ('SCHEDULED', 'RELEASED', 'CANCELLED', 'POSTPONED');

-- AlterTable
ALTER TABLE "calendar_preferences" ADD COLUMN     "timezone" TEXT;

-- AlterTable
ALTER TABLE "economic_events" ADD COLUMN     "frequency" TEXT,
ADD COLUMN     "lastSyncedAt" TIMESTAMP(3),
ADD COLUMN     "revisedPrevious" TEXT,
ADD COLUMN     "sourceUrl" TEXT,
ADD COLUMN     "status" "EconomicEventStatus" NOT NULL DEFAULT 'SCHEDULED',
ADD COLUMN     "unit" TEXT;

-- CreateTable
CREATE TABLE "economic_event_revisions" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "fieldChanged" TEXT NOT NULL,
    "oldValue" TEXT,
    "newValue" TEXT,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "provider" TEXT NOT NULL,

    CONSTRAINT "economic_event_revisions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "economic_event_revisions_eventId_changedAt_idx" ON "economic_event_revisions"("eventId", "changedAt");

-- CreateIndex
CREATE INDEX "economic_events_status_eventTime_idx" ON "economic_events"("status", "eventTime");

-- CreateIndex
CREATE INDEX "economic_events_lastSyncedAt_idx" ON "economic_events"("lastSyncedAt");

-- AddForeignKey
ALTER TABLE "economic_event_revisions" ADD CONSTRAINT "economic_event_revisions_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "economic_events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

