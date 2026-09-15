import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { getProviderByUserId } from "@/features/signals/provider-service";
import { listProviderSignals } from "@/features/signals/signal-service";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ManageSignalActions } from "@/components/signals/manage-signal-actions";

export const dynamic = "force-dynamic";

export default async function ManageSignalsPage() {
  const session = await auth();
  if (!session?.user) redirect("/auth/sign-in?callbackUrl=/signals/manage");

  const provider = await getProviderByUserId(session.user.id);
  if (!provider) redirect("/dashboard/become-signal-provider");

  const { items } = await listProviderSignals(provider.id, 1, 50);

  return (
    <main className="mx-auto max-w-3xl flex-1 px-6 py-12">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-slate-900">My signals</h1>
        <Link href="/signals/new" className={cn(buttonVariants({ size: "sm" }))}>
          New signal
        </Link>
      </div>

      <ul className="mt-6 divide-y divide-slate-100">
        {items.map((signal) => (
          <li key={signal.id} className="flex items-center justify-between gap-4 py-3">
            <div>
              <div className="flex items-center gap-2">
                <p className="font-medium text-slate-900">
                  {signal.instrument} {signal.direction}
                </p>
                <Badge>{signal.status}</Badge>
              </div>
              <p className="text-xs text-slate-500">{signal.publishedAt.toLocaleString()}</p>
            </div>
            {signal.status === "ACTIVE" && <ManageSignalActions signalId={signal.id} />}
          </li>
        ))}
        {items.length === 0 && <p className="py-8 text-center text-slate-500">No signals yet.</p>}
      </ul>
    </main>
  );
}
