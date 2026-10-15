import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdminPage } from "@/features/admin/viewer";
import { getBrokerForAdmin, listBrokersForAdmin } from "@/features/brokers/queries";
import { publishBlockers } from "@/lib/brokers/validation";
import { BrokerCard } from "@/components/brokers/broker-card";
import { BrokerForm, type BrokerFormValues } from "@/components/admin/broker-form";
import { BrokerRowActions } from "@/components/admin/broker-row-actions";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";

const ID = /^[a-z0-9]{10,40}$/i;

export default async function EditBrokerPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireAdminPage("broker:manage");
  const { id } = await params;
  if (!ID.test(id)) notFound();
  const broker = await getBrokerForAdmin(id);
  if (!broker) notFound();
  const justCreated = (await searchParams).created === "1";

  const peers = (await listBrokersForAdmin(broker.status)).map((b) => b.id);
  const index = peers.indexOf(broker.id);
  const blockers = publishBlockers(broker);

  const initial: BrokerFormValues = {
    name: broker.name,
    tagline: broker.tagline ?? "",
    officialUrl: broker.officialUrl,
    affiliateUrl: broker.affiliateUrl ?? "",
    sponsored: broker.sponsored,
    featured: broker.featured,
    features: broker.features,
    whySelected: broker.whySelected,
    bestFor: broker.bestFor,
    platforms: broker.platforms,
    instruments: broker.instruments ?? "",
    accountTypes: broker.accountTypes ?? "",
    minDeposit: broker.minDeposit ?? "",
    spreadsInfo: broker.spreadsInfo ?? "",
    regulation: broker.regulation ?? "",
    rating: broker.rating === null ? "" : String(broker.rating),
    ratingNote: broker.ratingNote ?? "",
    infoVerifiedAt: broker.infoVerifiedAt ? broker.infoVerifiedAt.toISOString().slice(0, 10) : "",
    position: "",
    hasLogo: Boolean(broker.logoMime),
  };

  return (
    <div>
      <Link href="/admin/brokers" className="text-xs text-blue-600 hover:underline">← All brokers</Link>
      <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">{broker.name}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Badge>{broker.status.charAt(0) + broker.status.slice(1).toLowerCase()}</Badge>
            {broker.status === "PUBLISHED" && (
              <Link href={`/best-brokers/${broker.slug}`} className="text-xs text-blue-600 hover:underline" target="_blank">
                View on the public page ↗
              </Link>
            )}
          </div>
        </div>
        <BrokerRowActions id={broker.id} name={broker.name} status={broker.status} rankable={broker.status !== "ARCHIVED"} isFirst={index <= 0} isLast={index === peers.length - 1} />
      </div>

      {justCreated && (
        <p role="status" className="mt-4 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          Broker created as a draft. Check the preview below, then publish it.
        </p>
      )}
      {broker.status === "DRAFT" && blockers.length > 0 && (
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
          <BrokerCard broker={broker} rank={broker.status === "PUBLISHED" ? peers.indexOf(broker.id) + 1 : null} preview={broker.status !== "PUBLISHED"} />
        </div>
      </section>

      {broker.status === "ARCHIVED" ? (
        <p className="mt-8 text-sm text-slate-600">This broker is archived. Restore it to edit or publish it again.</p>
      ) : (
        <section className="mt-10" aria-labelledby="edit-heading">
          <h2 id="edit-heading" className="text-lg font-semibold text-slate-900">Edit details</h2>
          <div className="mt-4">
            <BrokerForm brokerId={broker.id} initial={initial} />
          </div>
        </section>
      )}
    </div>
  );
}
