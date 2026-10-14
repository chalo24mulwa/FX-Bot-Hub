import { requirePartnershipAdminPage } from "@/features/partnership/guard";
import { getSettingsForAdmin } from "@/features/partnership/queries";
import { PartnershipAdminTabs } from "@/components/partnership/admin-tabs";
import { PartnershipSettingsForm } from "@/components/partnership/admin-controls";
import { DEFAULT_TERMS } from "@/lib/partnership/terms";
import { getMarketplaceSettings } from "@/features/admin/settings-service";

export const dynamic = "force-dynamic";

export default async function AdminPartnershipSettingsPage() {
  await requirePartnershipAdminPage();
  const [{ settings, categories }, marketplace] = await Promise.all([getSettingsForAdmin(), getMarketplaceSettings()]);
  const totalReferralPercent = (settings.partnerRateBps + settings.masterRateBps) / 100;

  return (
    <div className="min-w-0 max-w-3xl">
      <h1 className="text-2xl font-semibold text-slate-900">Partnership settings</h1>
      <p className="mt-1 text-sm text-slate-500">Changes apply to future sales only — every commission keeps the rate and amount it was calculated with.</p>
      <div className="mt-4">
        <PartnershipAdminTabs current="/admin/partnership/settings" />
      </div>
      {totalReferralPercent > marketplace.commissionPercent && (
        <p role="status" className="mb-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <strong>Check the economics:</strong> on a sale by a recruited Partner, referral commission can reach {totalReferralPercent}% of the price,
          while the marketplace commission you keep from sellers is {marketplace.commissionPercent}%. Referral commission is paid by FXBotHub, so
          those sales would cost more than they earn.
        </p>
      )}
      <PartnershipSettingsForm
        defaultTerms={DEFAULT_TERMS}
        categories={categories}
        initial={{
          programmeOpen: settings.programmeOpen,
          partnerRatePercent: settings.partnerRateBps / 100,
          masterRatePercent: settings.masterRateBps / 100,
          attributionDays: settings.attributionDays,
          referredUserCommissionDays: settings.referredUserCommissionDays,
          holdDays: settings.holdDays,
          minPayout: settings.minPayoutCents / 100,
          currencies: settings.currencies.join(", "),
          eligibleCategoryIds: settings.eligibleCategoryIds,
          payoutMethods: settings.payoutMethods,
          termsText: settings.termsText ?? "",
        }}
      />
    </div>
  );
}
