import crypto from "node:crypto";

/** 1 hour — short enough to limit an intercepted-email window, long enough
 * that a real user checking their inbox a bit late doesn't hit it. */
export const RESET_TOKEN_TTL_MS = 60 * 60 * 1000;

/** The raw token (256 bits) goes only into the emailed link and this
 * process's return value — it is never written to the database. Only its
 * SHA-256 hash is persisted (see PasswordResetToken.tokenHash), so a
 * database read alone can never be replayed to reset a password. */
export function generateResetToken(): { token: string; tokenHash: string } {
  const token = crypto.randomBytes(32).toString("hex");
  return { token, tokenHash: hashResetToken(token) };
}

export function hashResetToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}
