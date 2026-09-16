import { listDataSources } from "@/repositories/data-source-repository";
import { listSyncLogs } from "@/repositories/sync-log-repository";
import { listCalendarProviderKeys } from "@/services/calendar/providers";
import { listNewsProviderKeys } from "@/services/news/providers";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { DataSourceToggle } from "@/components/admin/data-source-toggle";
import { TriggerCalendarSyncButton } from "@/components/admin/trigger-calendar-sync-button";
import { registerDataSourceAction } from "@/features/admin/data-source-actions";
import { env } from "@/lib/env";

export const dynamic = "force-dynamic";

const STATUS_STYLES: Record<string, string> = {
  SUCCESS: "bg-emerald-50 text-emerald-700 border-emerald-200",
  FAILED: "bg-red-50 text-red-700 border-red-200",
  RUNNING: "bg-blue-50 text-blue-700 border-blue-200",
};

export default async function AdminDataSourcesPage() {
  const [sources, logs, calendarLogs] = await Promise.all([
    listDataSources(),
    listSyncLogs(undefined, 20),
    listSyncLogs("calendarSync", 10),
  ]);

  const lastSuccessful = calendarLogs.find((l) => l.status === "SUCCESS");
  const lastAttempt = calendarLogs[0];
  const calendarSources = sources.filter((s) => s.kind === "CALENDAR");
  const anyCalendarEnabled = calendarSources.some((s) => s.enabled);
  const nextSyncEstimate =
    anyCalendarEnabled && lastAttempt?.startedAt
      ? new Date(lastAttempt.startedAt.getTime() + env.ECONOMIC_CALENDAR_SYNC_INTERVAL_MINUTES * 60_000)
      : null;

  return (
    <div>
      <h1 className="text-2xl font-semibold text-slate-900">Data sources</h1>
      <p className="mt-1 text-sm text-slate-500">
        Available provider keys — calendar: {listCalendarProviderKeys().join(", ")}; news: {listNewsProviderKeys().join(", ")}.
      </p>

      <section className="mt-6 rounded-md border border-slate-200 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-slate-900">Economic calendar sync status</h2>
          <TriggerCalendarSyncButton />
        </div>
        <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-xs text-slate-400">Last successful sync</dt>
            <dd className="text-slate-700">{lastSuccessful?.startedAt.toLocaleString() ?? "never"}</dd>
          </div>
          <div>
            <dt className="text-xs text-slate-400">Last attempt</dt>
            <dd className="text-slate-700">
              {lastAttempt ? (
                <>
                  {lastAttempt.startedAt.toLocaleString()}{" "}
                  <Badge className={STATUS_STYLES[lastAttempt.status]}>{lastAttempt.status}</Badge>
                </>
              ) : (
                "never"
              )}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-slate-400">Next sync (estimated)</dt>
            <dd className="text-slate-700">
              {anyCalendarEnabled
                ? (nextSyncEstimate?.toLocaleString() ?? "pending first run")
                : "sync disabled"}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-slate-400">Inserted / updated / cancelled (last run)</dt>
            <dd className="text-slate-700">
              {lastAttempt ? `${lastAttempt.itemsInserted ?? 0} / ${lastAttempt.itemsUpdated ?? 0} / ${lastAttempt.itemsCancelled ?? 0}` : "—"}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-slate-400">Failed (last run)</dt>
            <dd className="text-slate-700">{lastAttempt?.itemsFailed ?? 0}</dd>
          </div>
          <div>
            <dt className="text-xs text-slate-400">Provider status</dt>
            <dd className="flex flex-wrap gap-1">
              {calendarSources.length === 0 && <span className="text-slate-500">no calendar sources registered</span>}
              {calendarSources.map((s) => (
                <Badge key={s.id} className={s.enabled ? "bg-slate-100 text-slate-700 border-slate-300" : "bg-slate-50 text-slate-400 border-slate-200"}>
                  {s.providerKey}: {s.enabled ? "enabled" : "disabled"}
                </Badge>
              ))}
            </dd>
          </div>
        </dl>
        {lastAttempt?.error && (
          <p className="mt-3 rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">{lastAttempt.error}</p>
        )}
        <p className="mt-3 text-xs text-slate-400">
          &ldquo;Next sync&rdquo; is an estimate only — there is no in-process scheduler; it assumes an external
          cron is configured to match ECONOMIC_CALENDAR_SYNC_INTERVAL_MINUTES (
          {env.ECONOMIC_CALENDAR_SYNC_INTERVAL_MINUTES} min). Use &ldquo;Run calendar sync now&rdquo; to sync
          immediately instead of waiting.
        </p>
      </section>

      <form action={registerDataSourceAction} className="mt-4 flex max-w-xl flex-wrap items-end gap-2">
        <label className="flex flex-col gap-1 text-xs">
          Name
          <Input name="name" placeholder="e.g. Manual calendar" className="w-40" required />
        </label>
        <label className="flex flex-col gap-1 text-xs">
          Kind
          <select name="kind" defaultValue="CALENDAR" className="h-10 rounded-md border border-slate-300 bg-white px-2 text-sm">
            <option value="CALENDAR">CALENDAR</option>
            <option value="NEWS">NEWS</option>
            <option value="MARKET_DATA">MARKET_DATA</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs">
          Provider key
          <Input name="providerKey" placeholder="manual" className="w-32" required />
        </label>
        <Button type="submit" size="sm">
          Register
        </Button>
      </form>

      <div className="mt-6 overflow-x-auto">
        <table className="w-full min-w-[640px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-slate-500">
              <th className="py-2 pr-3">Name</th>
              <th className="py-2 pr-3">Kind</th>
              <th className="py-2 pr-3">Provider key</th>
              <th className="py-2 pr-3">Last sync</th>
              <th className="py-2 pr-3">Status</th>
              <th className="py-2 pr-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {sources.map((source) => (
              <tr key={source.id} className="border-b border-slate-100">
                <td className="py-2 pr-3 font-medium">{source.name}</td>
                <td className="py-2 pr-3 text-slate-600">{source.kind}</td>
                <td className="py-2 pr-3 text-slate-600">{source.providerKey}</td>
                <td className="py-2 pr-3 text-slate-500">{source.lastSyncAt?.toLocaleString() ?? "never"}</td>
                <td className="py-2 pr-3">
                  {source.lastSyncStatus ? <Badge className={STATUS_STYLES[source.lastSyncStatus]}>{source.lastSyncStatus}</Badge> : "—"}
                </td>
                <td className="py-2 pr-3">
                  <DataSourceToggle id={source.id} enabled={source.enabled} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {sources.length === 0 && <p className="py-8 text-center text-slate-500">No data sources registered.</p>}
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
            {logs.map((log) => (
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
        {logs.length === 0 && <p className="py-8 text-center text-slate-500">No sync runs yet.</p>}
      </div>
    </div>
  );
}
