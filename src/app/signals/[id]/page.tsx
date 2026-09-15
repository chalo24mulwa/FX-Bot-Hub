import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { getSignal } from "@/features/signals/signal-service";
import { Badge } from "@/components/ui/badge";
import { auth } from "@/lib/auth";
import { track } from "@/lib/analytics/track";

export const dynamic = "force-dynamic";

interface SignalDetailPageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: SignalDetailPageProps): Promise<Metadata> {
  const { id } = await params;
  const signal = await getSignal(id);
  if (!signal) return {};
  return { title: `${signal.instrument} ${signal.direction} — ${signal.provider.displayName}` };
}

export default async function SignalDetailPage({ params }: SignalDetailPageProps) {
  const { id } = await params;
  const [signal, session] = await Promise.all([getSignal(id), auth()]);
  if (!signal) notFound();
  void track({ type: "SIGNAL_VIEW", userId: session?.user.id, metadata: { signalId: signal.id } });

  return (
    <main className="mx-auto max-w-2xl flex-1 px-6 py-12">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="text-2xl font-semibold text-slate-900">{signal.instrument}</h1>
        <Badge>{signal.direction}</Badge>
        <Badge>{signal.status}</Badge>
        <Badge>{signal.timeframe}</Badge>
      </div>
      <p className="mt-1 text-sm text-slate-500">
        by{" "}
        <Link href={`/signals/provider/${signal.provider.slug}`} className="hover:underline">
          {signal.provider.displayName}
        </Link>
        {signal.provider.verified && <span className="ml-1 text-blue-600">✓ Verified</span>}
        {" · "}
        {signal.publishedAt.toLocaleString()}
      </p>

      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        {signal.entryZoneLow !== null && (
          <Stat label="Entry" value={signal.entryZoneHigh ? `${signal.entryZoneLow}–${signal.entryZoneHigh}` : String(signal.entryZoneLow)} />
        )}
        {signal.stopLoss !== null && <Stat label="Stop-loss" value={String(signal.stopLoss)} />}
        {signal.takeProfit.length > 0 && <Stat label="Take-profit" value={signal.takeProfit.join(" / ")} />}
        {signal.resultPips !== null && (
          <Stat label="Result" value={`${signal.resultPips > 0 ? "+" : ""}${signal.resultPips} pips`} />
        )}
      </div>

      {signal.reasonMarkdown && (
        <div className="mt-6">
          <h2 className="text-sm font-semibold text-slate-900">Analysis</h2>
          <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">{signal.reasonMarkdown}</p>
        </div>
      )}

      <p className="mt-10 text-xs text-slate-400">
        This signal is published by an independent provider and reflects their own analysis. It is not
        guaranteed to be profitable and is not personalized financial advice.
      </p>
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
