import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getProviderByUserId } from "@/features/signals/provider-service";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { becomeSignalProviderAction } from "@/features/signals/actions";

export const dynamic = "force-dynamic";

export default async function BecomeSignalProviderPage() {
  const session = await auth();
  if (!session?.user) redirect("/auth/sign-in?callbackUrl=/dashboard/become-signal-provider");

  const existing = await getProviderByUserId(session.user.id);
  if (existing) redirect(`/signals/provider/${existing.slug}`);

  return (
    <div>
      <h1 className="text-2xl font-semibold text-slate-900">Become a signal provider</h1>
      <p className="mt-1 max-w-md text-sm text-slate-500">
        Publish BUY/SELL/WATCH calls with your own analysis. Your public track record is computed from
        signals you close — never fabricated, and clearly marked as self-reported unless an admin verifies it.
      </p>
      <form action={becomeSignalProviderAction} className="mt-6 flex max-w-sm flex-col gap-4">
        <label className="flex flex-col gap-1 text-sm">
          Display name
          <Input name="displayName" placeholder="e.g. Apex FX Signals" required minLength={2} />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Trading style
          <Input name="tradingStyle" placeholder="e.g. Swing trading, H4/D1" />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Markets (comma-separated)
          <Input name="markets" placeholder="EURUSD, GBPUSD, XAUUSD" />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Bio
          <textarea name="bio" rows={4} className="rounded-md border border-slate-300 px-3 py-2 text-sm" />
        </label>
        <Button type="submit">Start publishing signals</Button>
      </form>
    </div>
  );
}
