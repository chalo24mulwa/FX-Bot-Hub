import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getProviderByUserId } from "@/features/signals/provider-service";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { createSignalAction } from "@/features/signals/actions";

export const dynamic = "force-dynamic";

export default async function NewSignalPage() {
  const session = await auth();
  if (!session?.user) redirect("/auth/sign-in?callbackUrl=/signals/new");

  const provider = await getProviderByUserId(session.user.id);
  if (!provider) redirect("/dashboard/become-signal-provider");

  return (
    <main className="mx-auto max-w-lg flex-1 px-6 py-12">
      <h1 className="text-2xl font-semibold text-slate-900">Publish a signal</h1>
      <p className="mt-1 text-sm text-slate-500">Subscribers get notified immediately when this goes live.</p>

      <form action={createSignalAction} className="mt-6 flex flex-col gap-4">
        <label className="flex flex-col gap-1 text-sm">
          Instrument
          <Input name="instrument" placeholder="EURUSD" required />
        </label>

        <div className="grid grid-cols-2 gap-4">
          <label className="flex flex-col gap-1 text-sm">
            Direction
            <select name="direction" defaultValue="BUY" className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm">
              <option value="BUY">BUY</option>
              <option value="SELL">SELL</option>
              <option value="WATCH">WATCH</option>
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Timeframe
            <select name="timeframe" defaultValue="H1" className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm">
              {["M1", "M5", "M15", "M30", "H1", "H4", "D1", "W1"].map((tf) => (
                <option key={tf} value={tf}>
                  {tf}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <label className="flex flex-col gap-1 text-sm">
            Entry low
            <Input name="entryZoneLow" type="number" step="any" />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Entry high
            <Input name="entryZoneHigh" type="number" step="any" />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Stop-loss
            <Input name="stopLoss" type="number" step="any" />
          </label>
        </div>

        <label className="flex flex-col gap-1 text-sm">
          Take-profit level(s), comma-separated
          <Input name="takeProfit" placeholder="1.0950, 1.1000" />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          Analysis / reasoning
          <textarea name="reasonMarkdown" rows={5} className="rounded-md border border-slate-300 px-3 py-2 text-sm" />
        </label>

        <Button type="submit">Publish signal</Button>
      </form>
    </main>
  );
}
