import { emailQueue } from "@/lib/queue/queues";
import { logger } from "@/lib/logger";
import type { EmailTemplate } from "@/emails/templates";

/**
 * Enqueue an email for the BullMQ email worker (src/lib/queue/workers/
 * email-worker.ts) instead of calling emailProvider.send() inline — keeps
 * request handlers fast and lets a slow/down email provider retry without
 * failing the triggering request. Best-effort: a queue failure (e.g. Redis
 * unreachable in a dev environment without `docker compose up redis`) is
 * logged, not thrown, since email is never on the critical path.
 */
export async function enqueueEmail(to: string, template: EmailTemplate): Promise<void> {
  try {
    await emailQueue.add("send", { to, subject: template.subject, html: template.html });
  } catch (err) {
    console.error("[jobs/send-email] failed to enqueue:", err);
  }
}

/**
 * Sends straight through the configured EmailProvider, with no queue and no
 * worker in between. For mail a person is actively waiting on (password reset):
 * the queue path needs Redis *and* a running worker, and the Hostinger plan
 * fxbothub.com runs on has neither, so anything enqueued there is never
 * delivered. Never throws — callers fire it without awaiting (`void`), so a
 * slow or failing provider can neither delay nor change the response, which for
 * the forgot-password endpoint must be identical whether or not the address has
 * an account. Returns whether the provider accepted the message.
 */
export async function sendEmailNow(to: string, template: EmailTemplate): Promise<boolean> {
  try {
    // Imported lazily: the provider constructor throws on a half-configured
    // EMAIL_PROVIDER (resend without a key), and that must surface as a logged
    // send failure here — not as a crash at import time in every route that
    // merely imports this module (registration, alerts, …).
    const { emailProvider } = await import("@/lib/email");
    await emailProvider.send({ to, subject: template.subject, html: template.html, text: template.text });
    return true;
  } catch (err) {
    logger.error("email.send_failed", {
      recipientDomain: to.split("@")[1] ?? "unknown",
      subject: template.subject,
      error: err instanceof Error ? err.message : String(err),
    });
    return false;
  }
}
