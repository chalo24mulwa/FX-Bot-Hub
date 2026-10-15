-- CreateEnum
CREATE TYPE "AdminRole" AS ENUM ('USER_SUPPORT', 'LISTING_MODERATOR', 'PARTNERSHIP_MANAGER', 'FINANCE', 'CONTENT');

-- AlterTable
ALTER TABLE "audit_logs" ADD COLUMN     "impersonationSessionId" TEXT;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "mustChangePassword" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "admin_role_grants" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "AdminRole" NOT NULL,
    "grantedById" TEXT,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admin_role_grants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "impersonation_sessions" (
    "id" TEXT NOT NULL,
    "adminId" TEXT NOT NULL,
    "targetUserId" TEXT NOT NULL,
    "reason" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "endedAt" TIMESTAMP(3),
    "endReason" VARCHAR(40),
    "ipAddress" TEXT,

    CONSTRAINT "impersonation_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "admin_role_grants_role_idx" ON "admin_role_grants"("role");

-- CreateIndex
CREATE UNIQUE INDEX "admin_role_grants_userId_role_key" ON "admin_role_grants"("userId", "role");

-- CreateIndex
CREATE INDEX "impersonation_sessions_adminId_startedAt_idx" ON "impersonation_sessions"("adminId", "startedAt");

-- CreateIndex
CREATE INDEX "impersonation_sessions_targetUserId_startedAt_idx" ON "impersonation_sessions"("targetUserId", "startedAt");

-- CreateIndex
CREATE INDEX "impersonation_sessions_endedAt_expiresAt_idx" ON "impersonation_sessions"("endedAt", "expiresAt");

-- CreateIndex
CREATE INDEX "audit_logs_impersonationSessionId_idx" ON "audit_logs"("impersonationSessionId");

-- CreateIndex
CREATE INDEX "audit_logs_action_createdAt_idx" ON "audit_logs"("action", "createdAt");

-- AddForeignKey
ALTER TABLE "admin_role_grants" ADD CONSTRAINT "admin_role_grants_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admin_role_grants" ADD CONSTRAINT "admin_role_grants_grantedById_fkey" FOREIGN KEY ("grantedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "impersonation_sessions" ADD CONSTRAINT "impersonation_sessions_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "impersonation_sessions" ADD CONSTRAINT "impersonation_sessions_targetUserId_fkey" FOREIGN KEY ("targetUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

