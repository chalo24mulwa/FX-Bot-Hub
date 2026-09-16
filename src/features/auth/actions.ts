"use server";

import bcrypt from "bcryptjs";
import { requireSession } from "@/lib/authorization";
import { db } from "@/lib/db";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { changePasswordSchema, type ChangePasswordInput } from "@/lib/validations/auth";

const BCRYPT_ROUNDS = 12;

/** Signed-in "change password" — distinct from the signed-out "forgot
 * password" flow (password-reset-service.ts): this always requires the
 * current password, never a mailed token. Rate-limited per user so a
 * stolen/active session can't be used to brute-force the current password
 * (guessing it is otherwise the only barrier, since the session itself is
 * already authenticated). */
export async function changePasswordAction(input: ChangePasswordInput) {
  const session = await requireSession();
  const { currentPassword, newPassword } = changePasswordSchema.parse(input);

  await checkRateLimit(session.user.id, { bucket: "auth:change-password", limit: 5, windowSeconds: 300 });

  const user = await db.user.findUnique({ where: { id: session.user.id }, select: { password: true } });
  if (!user?.password) {
    throw new Error("This account has no password set — you sign in with Google.");
  }

  const valid = await bcrypt.compare(currentPassword, user.password);
  if (!valid) {
    throw new Error("Current password is incorrect.");
  }

  const passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
  await db.user.update({ where: { id: session.user.id }, data: { password: passwordHash } });
}
