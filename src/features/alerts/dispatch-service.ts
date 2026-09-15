import { db } from "@/lib/db";
import { createNotification } from "@/repositories/notification-repository";
import { enqueueEmail } from "@/jobs/send-email";
import { eventReminderQueue } from "@/lib/queue/queues";
import type {
  EconomicEvent,
  NewsArticle,
  Signal,
  SignalProviderProfile,
  NotificationType,
  AlertChannel,
} from "@prisma/client";

const siteUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

async function notifySubscribers(
  matches: { userId: string; channels: AlertChannel[] }[],
  type: NotificationType,
  title: string,
  body: string,
  link: string
) {
  const users = await db.user.findMany({
    where: { id: { in: matches.map((m) => m.userId) } },
    select: { id: true, email: true },
  });
  const emailById = new Map(users.map((u) => [u.id, u.email]));

  for (const match of matches) {
    if (match.channels.includes("IN_APP")) {
      void createNotification({ userId: match.userId, type, title, body, link });
    }
    if (match.channels.includes("EMAIL")) {
      const email = emailById.get(match.userId);
      if (email) {
        void enqueueEmail(email, { subject: title, html: `<p>${body}</p><p><a href="${siteUrl}${link}">View</a></p>`, text: `${body} ${siteUrl}${link}` });
      }
    }
  }
}

/** Fired once per genuinely new HIGH-impact event (see runCalendarSync) —
 * notifies anyone who subscribed to that currency, not to the specific
 * event (nobody could have; it didn't exist a moment ago). Subscribing to
 * a *specific* event instead schedules a pre-event reminder — see
 * scheduleEventReminder below, called from the event-detail subscribe action. */
export async function dispatchEconomicEventAlert(event: EconomicEvent) {
  const alerts = await db.alert.findMany({
    where: { type: "CURRENCY", targetId: event.currency },
    select: { userId: true, channels: true },
  });
  if (alerts.length === 0) return;

  await notifySubscribers(
    alerts,
    "ECONOMIC_EVENT_ALERT",
    `New high-impact ${event.currency} event: ${event.title}`,
    `Scheduled for ${event.eventTime.toISOString()}.`,
    `/calendar/event/${event.id}`
  );
}

/** Called right when a user subscribes to a specific event (not on sync) —
 * delivers a reminder ~30 minutes before it fires, if there's still time. */
export async function scheduleEventReminder(alertId: string, event: EconomicEvent) {
  const fireAt = event.eventTime.getTime() - 30 * 60_000;
  const delay = fireAt - Date.now();
  if (delay <= 0) return; // event is imminent or already past; nothing to schedule

  await eventReminderQueue.add(
    "remind",
    { alertId, eventId: event.id },
    { delay, jobId: `event-reminder:${alertId}` }
  );
}

export async function dispatchNewsAlert(article: NewsArticle) {
  const targetIds = [article.categoryId, article.currency].filter((v): v is string => Boolean(v));
  if (targetIds.length === 0) return;

  const alerts = await db.alert.findMany({
    where: {
      OR: [
        { type: "NEWS_TOPIC", targetId: article.categoryId ?? undefined },
        { type: "CURRENCY", targetId: article.currency ?? undefined },
      ],
    },
    select: { userId: true, channels: true },
  });
  if (alerts.length === 0) return;

  await notifySubscribers(alerts, "NEWS_ALERT", article.title, article.summary.slice(0, 140), `/news/${article.slug}`);
}

export async function dispatchSignalPublished(signal: Signal, provider: SignalProviderProfile) {
  const alerts = await db.alert.findMany({
    where: { type: "SIGNAL_PROVIDER", targetId: provider.id },
    select: { userId: true, channels: true },
  });
  if (alerts.length === 0) return;

  await notifySubscribers(
    alerts,
    "SIGNAL_PUBLISHED",
    `${provider.displayName}: new ${signal.direction} signal on ${signal.instrument}`,
    signal.reasonMarkdown?.slice(0, 140) ?? "",
    `/signals/${signal.id}`
  );
}

export async function dispatchSignalClosed(signal: Signal, provider: SignalProviderProfile) {
  const alerts = await db.alert.findMany({
    where: { type: "SIGNAL_PROVIDER", targetId: provider.id },
    select: { userId: true, channels: true },
  });
  if (alerts.length === 0) return;

  const resultLabel = signal.resultPips !== null ? `${signal.resultPips > 0 ? "+" : ""}${signal.resultPips} pips` : "closed";
  await notifySubscribers(
    alerts,
    "SIGNAL_CLOSED",
    `${provider.displayName}: ${signal.instrument} signal closed (${resultLabel})`,
    "",
    `/signals/${signal.id}`
  );
}
