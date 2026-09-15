import { db } from "@/lib/db";
import { recordSecurityEvent } from "@/repositories/security-event-repository";

const PAYMENT_FAILURE_WINDOW_MS = 60 * 60 * 1000; // 1 hour
const PAYMENT_FAILURE_THRESHOLD = 3;

const DOWNLOAD_WINDOW_MS = 10 * 60 * 1000; // 10 minutes
const DOWNLOAD_THRESHOLD = 30;

/**
 * Logs a SecurityEvent when a user has racked up several failed payments
 * in a short window — a signal worth an admin's attention (card testing,
 * a broken payment method), never an automatic block. Call this after
 * recording a FAILED Payment.
 */
export async function checkRepeatedPaymentFailures(userId: string): Promise<void> {
  const since = new Date(Date.now() - PAYMENT_FAILURE_WINDOW_MS);
  const failures = await db.payment.count({
    where: { status: "FAILED", order: { userId }, createdAt: { gte: since } },
  });
  if (failures >= PAYMENT_FAILURE_THRESHOLD) {
    await recordSecurityEvent({
      userId,
      type: "REPEATED_PAYMENT_FAILURE",
      severity: "MEDIUM",
      metadata: { failuresInWindow: failures, windowMinutes: PAYMENT_FAILURE_WINDOW_MS / 60_000 },
    });
  }
}

/**
 * Logs a SecurityEvent when a user's download volume in a short window is
 * unusually high — could be legitimate (a seller re-downloading their own
 * files while testing) or could be link/credential sharing; flagged for
 * admin review, not blocked. Call this after recording a successful
 * Download.
 */
export async function checkSuspiciousDownloadPattern(userId: string): Promise<void> {
  const since = new Date(Date.now() - DOWNLOAD_WINDOW_MS);
  const count = await db.download.count({ where: { userId, createdAt: { gte: since } } });
  if (count >= DOWNLOAD_THRESHOLD) {
    await recordSecurityEvent({
      userId,
      type: "SUSPICIOUS_DOWNLOAD_PATTERN",
      severity: "LOW",
      metadata: { downloadsInWindow: count, windowMinutes: DOWNLOAD_WINDOW_MS / 60_000 },
    });
  }
}
