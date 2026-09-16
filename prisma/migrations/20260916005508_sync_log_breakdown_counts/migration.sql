-- AlterTable
ALTER TABLE "sync_logs" ADD COLUMN     "itemsCancelled" INTEGER,
ADD COLUMN     "itemsInserted" INTEGER,
ADD COLUMN     "itemsUpdated" INTEGER;

