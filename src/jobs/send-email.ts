import { emailQueue } from "@/lib/queue/queues";
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
