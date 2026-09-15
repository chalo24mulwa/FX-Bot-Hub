import Link from "next/link";
import { auth } from "@/lib/auth";
import { listUserSubscriptions } from "@/features/signals/subscription-service";
import { Badge } from "@/components/ui/badge";
import { SubscriptionRowActions } from "@/components/signals/subscription-row-actions";

export const dynamic = "force-dynamic";

export default async function SubscriptionsPage() {
  const session = await auth();
  const subscriptions = await listUserSubscriptions(session!.user.id);

  return (
    <div>
      <h1 className="text-2xl font-semibold text-slate-900">Signal subscriptions</h1>

      {subscriptions.length === 0 ? (
        <p className="mt-4 text-slate-500">
          No subscriptions yet. <Link href="/signals" className="text-blue-600 hover:underline">Browse signal providers</Link>.
        </p>
      ) : (
        <ul className="mt-4 divide-y divide-slate-100">
          {subscriptions.map((sub) => (
            <li key={sub.id} className="flex items-center justify-between gap-4 py-3">
              <div>
                <Link href={`/signals/provider/${sub.provider.slug}`} className="font-medium text-slate-900 hover:underline">
                  {sub.provider.displayName}
                </Link>
                <div className="mt-1 flex items-center gap-2">
                  <Badge>{sub.status}</Badge>
                  {sub.currentPeriodEnd && (
                    <span className="text-xs text-slate-400">renews {sub.currentPeriodEnd.toLocaleDateString()}</span>
                  )}
                </div>
              </div>
              <SubscriptionRowActions providerId={sub.providerId} status={sub.status} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
