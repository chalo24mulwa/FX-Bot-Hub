import { db } from "@/lib/db";
import { createNotification } from "@/repositories/notification-repository";
import { enqueueEmail } from "@/jobs/send-email";
import type { EmailTemplate } from "@/emails/templates";
import type { NotificationType } from "@prisma/client";

// Channel abstraction ready for push/SMS later — adding one means adding a
// case in the switch below, not touching every call site (same shape as
// the payment/email/storage provider pattern used elsewhere in this app).
export type NotificationChannel = "IN_APP" | "EMAIL";

export interface NotifyInput {
  userId: string;
  type: NotificationType;
  title: string;
  body?: string;
  link?: string;
  /** Matching email content — required if EMAIL is a requested channel. */
  email?: EmailTemplate;
  /** Skip the recipient-email lookup when the caller already has it (most
   * do — checkout, for instance, already loaded the buyer/seller row). */
  emailAddress?: string;
  /** Defaults to IN_APP + EMAIL (when `email` is given) or IN_APP alone. */
  channels?: NotificationChannel[];
}

/**
 * Phase 5 (docs/PHASE5_AUDIT.md): before this, every call site independently
 * called createNotification() and enqueueEmail() side by side with no
 * shared abstraction — 14+ places duplicating the same two-call pattern.
 * This is the unified replacement, but existing call sites were
 * deliberately NOT mass-migrated to it in this pass — that's 14 already-
 * working, already-tested call sites, and rewriting all of them
 * simultaneously this late in a single change is a real regression risk
 * for no functional gain (the old pattern isn't broken, just duplicated).
 * New notification call sites should use this; existing ones can migrate
 * opportunistically when touched for another reason — event-reminder-worker.ts
 * is migrated already, as a working example of the pattern.
 */
export async function notify(input: NotifyInput): Promise<void> {
  const channels = input.channels ?? (input.email ? (["IN_APP", "EMAIL"] as NotificationChannel[]) : ["IN_APP"]);

  if (channels.includes("IN_APP")) {
    void createNotification({ userId: input.userId, type: input.type, title: input.title, body: input.body, link: input.link });
  }

  if (channels.includes("EMAIL") && input.email) {
    const email = input.emailAddress ?? (await db.user.findUnique({ where: { id: input.userId }, select: { email: true } }))?.email;
    if (email) void enqueueEmail(email, input.email);
  }
}
