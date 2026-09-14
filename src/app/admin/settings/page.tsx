import { getMarketplaceSettings, getRankingWeights } from "@/features/admin/settings-service";
import { SettingsForm } from "@/components/admin/settings-form";

export const dynamic = "force-dynamic";

export default async function AdminSettingsPage() {
  const settings = await getMarketplaceSettings();

  return (
    <div>
      <h1 className="text-2xl font-semibold text-slate-900">Marketplace settings</h1>
      <div className="mt-6">
        <SettingsForm commissionPercent={settings.commissionPercent} rankingWeights={getRankingWeights(settings)} />
      </div>
    </div>
  );
}
