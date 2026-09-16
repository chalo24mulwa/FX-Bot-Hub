import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { generateResetToken, hashResetToken, RESET_TOKEN_TTL_MS } from "@/lib/security/password-reset-token";
import { enqueueEmail } from "@/jobs/send-email";
import { buildPasswordResetEmail } from "@/emails/templates";

const BCRYPT_ROUNDS = 12;
const siteUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

export class InvalidResetTokenError extends Error {
  constructor() {
    super("This password reset link is invalid or has expired.");
  }
}

/**
 * Always resolves the same way whether or not `email` matches a real,
 * resettable account — the caller (POST /api/auth/forgot-password) returns
 * one generic response regardless, so this can never be used to enumerate
 * registered emails. A match gets a real single-use token emailed to it; a
 * non-match (including a Google-only account with no password, or a
 * banned account) triggers no observable side effect at all.
 */
export async function requestPasswordReset(email: string): Promise<void> {
  const user = await db.user.findUnique({ where: { email } });
  if (!user?.password || user.bannedAt) return;

  const { token, tokenHash } = generateResetToken();
  await db.passwordResetToken.create({
    data: { userId: user.id, tokenHash, expiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MS) },
  });

  const resetUrl = `${siteUrl}/auth/reset-password?token=${token}`;
  void enqueueEmail(user.email, buildPasswordResetEmail(resetUrl));
}

/**
 * Validates and consumes a reset token in one step. Also invalidates every
 * other outstanding token for that user — a stale, unused link from an
 * earlier request shouldn't keep working after a newer one has succeeded.
 * Existing password/account rows are otherwise untouched: same user id,
 * same role, same everything except the password hash.
 */
export async function resetPassword(token: string, newPassword: string): Promise<void> {
  const tokenHash = hashResetToken(token);
  const record = await db.passwordResetToken.findUnique({ where: { tokenHash } });

  if (!record || record.usedAt || record.expiresAt < new Date()) {
    throw new InvalidResetTokenError();
  }

  const passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);

  await db.$transaction([
    db.user.update({ where: { id: record.userId }, data: { password: passwordHash } }),
    db.passwordResetToken.update({ where: { id: record.id }, data: { usedAt: new Date() } }),
    db.passwordResetToken.updateMany({
      where: { userId: record.userId, usedAt: null, id: { not: record.id } },
      data: { usedAt: new Date() },
    }),
  ]);
}
