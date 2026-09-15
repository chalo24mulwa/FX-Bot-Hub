import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { can } from "@/lib/authorization/permissions";
import { Badge } from "@/components/ui/badge";
import { listSyncLogs } from "@/repositories/sync-log-repository";
import {
  emailQueue,
  calendarSyncQueue,
  newsSyncQueue,
  marketDataSyncQueue,
  eventReminderQueue,
  subscriptionRenewalQueue,
} from "@/lib/queue/queues";
import type { Queue } from "bullmq";

export const dynamic = "force-dynamic";

const QUEUES: { name: string; queue: Queue }[] = [
  { name: "email", queue: emailQueue },
  { name: "calendar-sync", queue: calendarSyncQueue },
  { name: "news-sync", queue: newsSyncQueue },
  { name: "market-data-sync", queue: marketDataSyncQueue },
  { name: "event-reminder", queue: eventReminderQueue },
  { name: "subscription-renewal", queue: subscriptionRenewalQueue },
];

const STATUS_STYLES: Record<string, string> = {
  SUCCESS: "bg-emerald-50 text-emerald-700 border-emerald-200",
  FAILED: "bg-red-50 text-red-700 border-red-200",
  RUNNING: "bg-blue-50 text-blue-700 border-blue-200",
};

// BullMQ's own connection handling doesn't reliably bound how long a
// command waits when Redis has never been reachable at all (distinct from
// "was reachable, then dropped," which src/lib/redis.ts's commandTimeout
// is tuned for) — this page hung indefinitely under that condition until
// this timeout guard was added (found by running the full e2e suite, not
// by inspection). Never let a monitoring page become unusable because the
// thing it's monitoring is down.
const QUEUE_STATUS_TIMEOUT_MS = 3000;

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T | null> {
  return Promise.race([promise, new Promise<null>((resolve) => setTimeout(() => resolve(null), ms))]);
}

// Deliberately minimal — job counts per queue plus recent sync runs, not a
// full job browser/retry UI (a real one is a Bull Board integration,
// flagged as a follow-up in docs/PHASE5_AUDIT.md). This exists so a down
// worker or a stuck queue is *visible* somewhere, which was previously
// nowhere (console.error only).
export default async function AdminQueuesPage() {
  const session = await auth();
  if (!session?.user || !can(session.user.role, "queue:view")) redirect("/auth/sign-in");

  const [counts, recentLogs] = await Promise.all([
    Promise.all(
      QUEUES.map(async ({ name, queue }) => ({
        name,
        counts: await withTimeout(
          queue.getJobCounts("waiting", "active", "completed", "failed", "delayed"),
          QUEUE_STATUS_TIMEOUT_MS
        ),
      }))
    ),
    listSyncLogs(undefined, 30),
  ]);

  return (
    <div>
      <h1 className="text-2xl font-semibold text-slate-900">Background jobs</h1>
      <p className="mt-1 text-sm text-slate-500">
        Per-queue job counts and recent sync runs. For a full job browser with retry, add a Bull Board
        integration — not built here.
      </p>

      <div className="mt-6 overflow-x-auto">
        <table className="w-full min-w-[640px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-slate-500">
              <th className="py-2 pr-3">Queue</th>
              <th className="py-2 pr-3">Waiting</th>
              <th className="py-2 pr-3">Active</th>
              <th className="py-2 pr-3">Delayed</th>
              <th className="py-2 pr-3">Completed</th>
              <th className="py-2 pr-3">Failed</th>
            </tr>
          </thead>
          <tbody>
            {counts.map((row) =>
              row.counts ? (
                <tr key={row.name} className="border-b border-slate-100">
                  <td className="py-2 pr-3 font-medium text-slate-900">{row.name}</td>
                  <td className="py-2 pr-3 text-slate-600">{row.counts.waiting ?? 0}</td>
                  <td className="py-2 pr-3 text-slate-600">{row.counts.active ?? 0}</td>
                  <td className="py-2 pr-3 text-slate-600">{row.counts.delayed ?? 0}</td>
                  <td className="py-2 pr-3 text-slate-600">{row.counts.completed ?? 0}</td>
                  <td className={`py-2 pr-3 font-medium ${(row.counts.failed ?? 0) > 0 ? "text-red-600" : "text-slate-600"}`}>
                    {row.counts.failed ?? 0}
                  </td>
                </tr>
              ) : (
                <tr key={row.name} className="border-b border-slate-100">
                  <td className="py-2 pr-3 font-medium text-slate-900">{row.name}</td>
                  <td colSpan={5} className="py-2 pr-3 text-xs text-amber-600">
                    Unavailable (Redis not reachable within {QUEUE_STATUS_TIMEOUT_MS / 1000}s)
                  </td>
                </tr>
              )
            )}
          </tbody>
        </table>
      </div>

      <h2 className="mt-10 text-lg font-semibold text-slate-900">Recent sync runs</h2>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[560px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-slate-500">
              <th className="py-2 pr-3">Job</th>
              <th className="py-2 pr-3">Started</th>
              <th className="py-2 pr-3">Status</th>
              <th className="py-2 pr-3">Processed / Failed</th>
              <th className="py-2 pr-3">Error</th>
            </tr>
          </thead>
          <tbody>
            {recentLogs.map((log) => (
              <tr key={log.id} className="border-b border-slate-100">
                <td className="py-2 pr-3 font-medium">{log.jobName}</td>
                <td className="py-2 pr-3 text-slate-500">{log.startedAt.toLocaleString()}</td>
                <td className="py-2 pr-3">
                  <Badge className={STATUS_STYLES[log.status]}>{log.status}</Badge>
                </td>
                <td className="py-2 pr-3 text-slate-600">
                  {log.itemsProcessed ?? 0} / {log.itemsFailed}
                </td>
                <td className="py-2 pr-3 text-xs text-red-600">{log.error ?? ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {recentLogs.length === 0 && <p className="py-8 text-center text-slate-500">No sync runs yet.</p>}
      </div>
    </div>
  );
}
