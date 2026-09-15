import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getProviderBySlug, computeProviderStats } from "@/features/signals/provider-service";
import { listProviderSignals } from "@/features/signals/signal-service";
import { hasActiveSubscription } from "@/features/signals/subscription-service";
import { Badge } from "@/components/ui/badge";
import { SignalCard } from "@/components/signals/signal-card";
import { SubscribeProviderButton } from "@/components/signals/subscribe-provider-button";
import { AlertSubscribeButton } from "@/components/alerts/alert-subscribe-button";
import { formatPriceCents } from "@/lib/utils";

export const dynamic = "force-dynamic";

interface ProviderPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: ProviderPageProps): Promise<Metadata> {
  const { slug } = await params;
  if (slug === "me") return {};
  const provider = await getProviderBySlug(slug);
  if (!provider) return {};
  return {
    title: provider.displayName,
    description: provider.bio ?? `${provider.displayName}'s Forex signal track record on FX Bot Market.`,
    alternates: { canonical: `/signals/provider/${provider.slug}` },
  };
}

export default async function ProviderPage({ params }: ProviderPageProps) {
  const { slug } = await params;
  const session = await auth();

  if (slug === "me") {
    if (!session?.user) redirect("/auth/sign-in?callbackUrl=/signals/provider/me");
    const { getProviderByUserId } = await import("@/features/signals/provider-service");
    const own = await getProviderByUserId(session.user.id);
    if (!own) redirect("/dashboard/become-signal-provider");
    redirect(`/signals/provider/${own.slug}`);
  }

  const provider = await getProviderBySlug(slug);
  if (!provider) notFound();

  const [stats, { items: signals }, subscribed, alertSubscribed] = await Promise.all([
    computeProviderStats(provider.id),
    listProviderSignals(provider.id, 1, 20),
    session?.user ? hasActiveSubscription(session.user.id, provider.id) : Promise.resolve(false),
    session?.user
      ? db.alert
          .findUnique({ where: { userId_type_targetId: { userId: session.user.id, type: "SIGNAL_PROVIDER", targetId: provider.id } } })
          .then(Boolean)
      : Promise.resolve(false),
  ]);

  const isOwner = session?.user?.id === provider.userId;

  return (
    <main className="mx-auto max-w-4xl flex-1 px-6 py-12">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold text-slate-900">{provider.displayName}</h1>
            {provider.verified ? (
              <Badge className="border-blue-300 bg-blue-50 text-blue-800">✓ Verified performance</Badge>
            ) : (
              <Badge>Self-reported performance</Badge>
            )}
          </div>
          {provider.tradingStyle && <p className="mt-1 text-sm text-slate-500">{provider.tradingStyle}</p>}
          {provider.markets.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {provider.markets.map((m) => (
                <Badge key={m}>{m}</Badge>
              ))}
            </div>
          )}
        </div>

        {!isOwner && session?.user && !subscribed && (
          <SubscribeProviderButton
            providerId={provider.id}
            label={provider.pricingType === "FREE" ? "Subscribe for free" : `Subscribe — ${formatPriceCents(provider.priceCents, provider.currency)}/mo`}
          />
        )}
        {subscribed && <p className="text-sm font-medium text-emerald-700">✓ Subscribed</p>}
        {isOwner && (
          <Link href="/signals/new" className="text-sm text-blue-600 hover:underline">
            Publish a new signal
          </Link>
        )}
      </div>

      {provider.bio && <p className="mt-6 text-slate-700">{provider.bio}</p>}

      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-5">
        <Stat label="Signals" value={String(stats.totalSignals)} />
        <Stat label="Closed" value={String(stats.closedSignals)} />
        <Stat label="Win rate" value={stats.winRatePercent !== null ? `${stats.winRatePercent.toFixed(0)}%` : "—"} />
        <Stat
          label="Avg result"
          value={stats.averageResultPips !== null ? `${stats.averageResultPips.toFixed(1)} pips` : "—"}
        />
        <Stat label="Subscribers" value={String(stats.subscriberCount)} />
      </div>

      {session?.user && (
        <div className="mt-6">
          <AlertSubscribeButton
            type="SIGNAL_PROVIDER"
            targetId={provider.id}
            initialSubscribed={alertSubscribed}
            label="Get notified of new signals"
          />
        </div>
      )}

      <section className="mt-10">
        <h2 className="text-lg font-semibold text-slate-900">Recent signals</h2>
        {signals.length === 0 ? (
          <p className="mt-2 text-sm text-slate-500">No signals published yet.</p>
        ) : (
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            {signals.map((signal) => (
              <SignalCard key={signal.id} signal={signal} />
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-slate-200 p-3 text-center">
      <p className="text-xs text-slate-400">{label}</p>
      <p className="font-semibold text-slate-900">{value}</p>
    </div>
  );
}
