import type { Metadata } from "next";
import Link from "next/link";
import { listSignals } from "@/features/signals/signal-service";
import { SignalCard } from "@/components/signals/signal-card";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { SignalDirection, SignalStatus } from "@prisma/client";

export const metadata: Metadata = { title: "Forex Signals" };
export const dynamic = "force-dynamic";

interface SignalsPageProps {
  searchParams: Promise<{ direction?: string; status?: string; instrument?: string; page?: string }>;
}

export default async function SignalsPage({ searchParams }: SignalsPageProps) {
  const params = await searchParams;
  const { items, total } = await listSignals({
    direction: params.direction as SignalDirection | undefined,
    status: (params.status as SignalStatus | undefined) ?? "ACTIVE",
    instrument: params.instrument,
    page: Number(params.page ?? 1),
  });

  return (
    <main className="mx-auto max-w-5xl flex-1 px-6 py-12">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Forex Signals</h1>
          <p className="mt-1 text-sm text-slate-500">{total} signal{total === 1 ? "" : "s"}</p>
        </div>
        <Link href="/dashboard/become-signal-provider" className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
          Become a signal provider
        </Link>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {["ACTIVE", "CLOSED"].map((s) => (
          <Link
            key={s}
            href={`/signals?status=${s}`}
            className={`rounded-full px-3 py-1 text-xs font-medium ${(params.status ?? "ACTIVE") === s ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
          >
            {s}
          </Link>
        ))}
        {["BUY", "SELL", "WATCH"].map((d) => (
          <Link
            key={d}
            href={`/signals?status=${params.status ?? "ACTIVE"}&direction=${d}`}
            className={`rounded-full px-3 py-1 text-xs font-medium ${params.direction === d ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
          >
            {d}
          </Link>
        ))}
      </div>

      {items.length === 0 ? (
        <p className="mt-8 text-slate-500">No signals yet.</p>
      ) : (
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((signal) => (
            <SignalCard key={signal.id} signal={signal} />
          ))}
        </div>
      )}

      <p className="mt-8 max-w-2xl text-xs text-slate-400">
        Signals are published by independent providers and are not guaranteed to be profitable. Past
        performance does not indicate future results. Trade at your own risk.
      </p>
    </main>
  );
}
