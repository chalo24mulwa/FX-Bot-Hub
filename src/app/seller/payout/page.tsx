import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getMarketplaceSettings } from "@/features/admin/settings-service";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { updatePayoutSettingsAction } from "@/features/seller/actions";

export const dynamic = "force-dynamic";

export default async function SellerPayoutPage() {
  const session = await auth();
  const [profile, settings] = await Promise.all([
    db.sellerProfile.findUnique({ where: { userId: session!.user.id } }),
    getMarketplaceSettings(),
  ]);

  return (
    <div>
      <h1 className="text-2xl font-semibold text-slate-900">Payout settings</h1>
      <p className="mt-1 text-sm text-slate-500">
        Marketplace commission: {settings.commissionPercent}% — you keep {100 - settings.commissionPercent}% of every sale.
      </p>
      <form action={updatePayoutSettingsAction} className="mt-6 flex max-w-md flex-col gap-4">
        <label className="flex flex-col gap-1 text-sm">
          Payout email
          <Input name="payoutEmail" type="email" defaultValue={profile?.payoutEmail ?? ""} placeholder="you@example.com" />
        </label>
        <p className="text-xs text-slate-400">
          Actual payouts require a real payment processor account (Stripe Connect / M-Pesa B2C) — not wired up yet.
          This just records where payouts should go.
        </p>
        <Button type="submit" className="self-start">
          Save
        </Button>
      </form>
    </div>
  );
}
