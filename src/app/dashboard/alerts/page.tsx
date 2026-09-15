import { auth } from "@/lib/auth";
import { listUserAlerts } from "@/features/alerts/alert-service";
import { Badge } from "@/components/ui/badge";
import { UnsubscribeButton } from "@/components/alerts/unsubscribe-button";

export const dynamic = "force-dynamic";

const TYPE_LABELS: Record<string, string> = {
  ECONOMIC_EVENT: "Economic event",
  CURRENCY: "Currency",
  SIGNAL_PROVIDER: "Signal provider",
  PRODUCT: "Product",
  NEWS_TOPIC: "News topic",
};

export default async function AlertsPage() {
  const session = await auth();
  const alerts = await listUserAlerts(session!.user.id);

  return (
    <div>
      <h1 className="text-2xl font-semibold text-slate-900">Alerts</h1>
      <p className="mt-1 text-sm text-slate-500">
        Subscribe from an event, currency, signal provider, product, or news category page.
      </p>

      {alerts.length === 0 ? (
        <p className="mt-4 text-slate-500">No alert subscriptions yet.</p>
      ) : (
        <ul className="mt-4 divide-y divide-slate-100">
          {alerts.map((alert) => (
            <li key={alert.id} className="flex items-center justify-between gap-4 py-3">
              <div>
                <div className="flex items-center gap-2">
                  <Badge>{TYPE_LABELS[alert.type]}</Badge>
                  <span className="text-sm font-medium text-slate-900">{alert.targetId}</span>
                </div>
                <p className="text-xs text-slate-500">via {alert.channels.join(", ")}</p>
              </div>
              <UnsubscribeButton type={alert.type} targetId={alert.targetId} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
