import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdminPage } from "@/features/admin/viewer";
import { getVpsForAdmin, listVpsForAdmin } from "@/features/vps/queries";
import { vpsPublishBlockers } from "@/lib/vps/validation";
import { VpsCard } from "@/components/vps/vps-card";
import { VpsForm, type VpsFormValues } from "@/components/admin/vps-form";
import { VpsRowActions } from "@/components/admin/vps-row-actions";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";

const ID = /^[a-z0-9]{10,40}$/i;
const day = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : "");

export default async function EditVpsPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireAdminPage("vps:manage");
  const { id } = await params;
  if (!ID.test(id)) notFound();
  const provider = await getVpsForAdmin(id);
  if (!provider) notFound();
  const justCreated = (await searchParams).created === "1";

  const peers = (await listVpsForAdmin(provider.status)).map((p) => p.id);
  const index = peers.indexOf(provider.id);
  const blockers = vpsPublishBlockers(provider);

  const initial: VpsFormValues = {
    id: provider.id,
    name: provider.name,
    category: provider.category ?? "",
    headline: provider.headline ?? "",
    description: provider.description,
    officialUrl: provider.officialUrl,
    affiliateUrl: provider.affiliateUrl ?? "",
    ctaLabel: provider.ctaLabel ?? "",
    promoCode: provider.promoCode ?? "",
    offerText: provider.offerText ?? "",
    offerExpiresAt: day(provider.offerExpiresAt),
    sponsored: provider.sponsored,
    disclosureNote: provider.disclosureNote ?? "",
    featured: provider.featured,
    features: provider.features,
    advantages: provider.advantages,
    limitations: provider.limitations,
    whyRecommend: provider.whyRecommend,
    bestFor: provider.bestFor,
    operatingSystems: provider.operatingSystems,
    serverLocations: provider.serverLocations,
    platforms: provider.platforms,
    cpu: provider.cpu ?? "",
    ram: provider.ram ?? "",
    storage: provider.storage ?? "",
    otherSpecs: provider.otherSpecs ?? "",
    price: provider.priceCents === null ? "" : (provider.priceCents / 100).toFixed(2),
    priceCurrency: provider.priceCurrency ?? "",
    pricePeriod: provider.pricePeriod ?? "",
    freeTrial: provider.freeTrial,
    trialNote: provider.trialNote ?? "",
    latencyInfo: provider.latencyInfo ?? "",
    latencySource: provider.latencySource ?? "",
    rating: provider.rating === null ? "" : String(provider.rating),
    ratingNote: provider.ratingNote ?? "",
    seoTitle: provider.seoTitle ?? "",
    seoDescription: provider.seoDescription ?? "",
    infoVerifiedAt: day(provider.infoVerifiedAt),
    position: "",
    hasLogo: Boolean(provider.logoMime),
    hasCover: Boolean(provider.coverMime),
    logoVersion: provider.logoUpdatedAt?.getTime(),
    coverVersion: provider.coverUpdatedAt?.getTime(),
  };

  return (
    <div>
      <Link href="/admin/vps" className="text-xs text-blue-600 hover:underline">← All providers</Link>
      <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">{provider.name}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Badge>{provider.status.charAt(0) + provider.status.slice(1).toLowerCase()}</Badge>
            {provider.status === "PUBLISHED" && (
              <Link href={`/vps/${provider.slug}`} className="text-xs text-blue-600 hover:underline" target="_blank">
                View on the public page ↗
              </Link>
            )}
          </div>
        </div>
        <VpsRowActions id={provider.id} name={provider.name} status={provider.status} rankable={provider.status !== "ARCHIVED"} isFirst={index <= 0} isLast={index === peers.length - 1} />
      </div>

      {justCreated && (
        <p role="status" className="mt-4 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          Provider created as a draft. Check the preview below, then publish it.
        </p>
      )}
      {provider.status === "DRAFT" && blockers.length > 0 && (
        <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          <p className="font-medium">Before this can be published:</p>
          <ul className="mt-1 list-disc pl-5">
            {blockers.map((b) => <li key={b}>{b}</li>)}
          </ul>
        </div>
      )}

      <section className="mt-8" aria-labelledby="preview-heading">
        <h2 id="preview-heading" className="text-sm font-semibold uppercase tracking-wide text-slate-500">Preview — as it appears on the public page</h2>
        <p className="mt-1 text-xs text-slate-500">Reflects the last saved version. Save your changes to refresh it.</p>
        <div className="mt-3 max-w-4xl">
          <VpsCard provider={provider} rank={provider.status === "PUBLISHED" ? index + 1 : null} preview={provider.status !== "PUBLISHED"} />
        </div>
      </section>

      {provider.status === "ARCHIVED" ? (
        <p className="mt-8 text-sm text-slate-600">This provider is archived. Restore it to edit or publish it again.</p>
      ) : (
        <section className="mt-10" aria-labelledby="edit-heading">
          <h2 id="edit-heading" className="text-lg font-semibold text-slate-900">Edit details</h2>
          <div className="mt-4">
            <VpsForm providerId={provider.id} initial={initial} />
          </div>
        </section>
      )}
    </div>
  );
}
