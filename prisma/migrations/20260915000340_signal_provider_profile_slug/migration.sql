-- AlterTable
ALTER TABLE "signal_provider_profiles" ADD COLUMN     "slug" TEXT NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "signal_provider_profiles_slug_key" ON "signal_provider_profiles"("slug");

