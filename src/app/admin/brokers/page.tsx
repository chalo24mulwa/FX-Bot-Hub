import Link from "next/link";
import type { BrokerStatus } from "@prisma/client";
import { requireAdminPage } from "@/features/admin/viewer";
import { countBrokersByStatus, listBrokersForAdmin } from "@/features/brokers/queries";
import { BrokerLogo } from "@/components/brokers/broker-logo";
import { BrokerRowActions } from "@/components/admin/broker-row-actions";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

const STATUS_STYLES: Record<BrokerStatus, string> = {
  PUBLISHED: "border-emerald-200 bg-emerald-50 text-emerald-800",
  DRAFT: "border-slate-200 bg-slate-50 text-slate-700",
  ARCHIVED: "border-amber-200 bg-amber-50 text-amber-800",
};

function parseStatus(value: unknown): BrokerStatus | undefined {
  return value === "PUBLISHED" || value === "DRAFT" || value === "ARCHIVED" ? value : undefined;
}

export default async function AdminBrokersPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireAdminPage("broker:manage");
  const status = parseStatus((await searchParams).status);
  const [brokers, counts, published] = await Promise.all([listBrokersForAdmin(status), countBrokersByStatus(), listBrokersForAdmin("PUBLISHED")]);
  const publishedIds = published.map((b) => b.id);
  const draftIds = (await listBrokersForAdmin("DRAFT")).map((b) => b.id);
  const total = counts.DRAFT + counts.PUBLISHED + counts.ARCHIVED;

  const tabs: { key: BrokerStatus | undefined; label: string; count: number }[] = [
    { key: undefined, label: "All", count: total },
    { key: "PUBLISHED", label: "Published", count: counts.PUBLISHED },
    { key: "DRAFT", label: "Drafts", count: counts.DRAFT },
    { key: "ARCHIVED", label: "Archived", count: counts.ARCHIVED },
  ];

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Best Brokers</h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-600">
            Manage the brokers shown at{" "}
            <Link href="/best-brokers" className="text-blue-600 hover:underline">/best-brokers</Link>. Only published brokers are public; their order here is their public ranking. Enter only information you have verified.
          </p>
        </div>
        <Link href="/admin/brokers/new" className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800">
          Add broker
        </Link>
      </div>

      <nav aria-label="Filter by status" className="mt-5 flex flex-wrap gap-2">
        {tabs.map((tab) => (
          <Link
            key={tab.label}
            href={tab.key ? `/admin/brokers?status=${tab.key}` : "/admin/brokers"}
            aria-current={status === tab.key ? "page" : undefined}
            className={cn("rounded-full border px-3 py-1 text-sm", status === tab.key ? "border-slate-900 bg-slate-900 text-white" : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50")}
          >
            {tab.label} <span className="opacity-70">{tab.count}</span>
          </Link>
        ))}
      </nav>

      {brokers.length === 0 ? (
        <p className="mt-8 rounded-lg border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-600">
          {total === 0 ? "No brokers yet. Add the first one — it stays a draft until you publish it." : "No brokers with that status."}
        </p>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="w-full min-w-[44rem] text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th scope="col" className="px-4 py-3">Public rank</th>
                <th scope="col" className="px-4 py-3">Broker</th>
                <th scope="col" className="px-4 py-3">Status</th>
                <th scope="col" className="px-4 py-3">Link</th>
                <th scope="col" className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {brokers.map((broker) => {
                const group = broker.status === "PUBLISHED" ? publishedIds : broker.status === "DRAFT" ? draftIds : [];
                const index = group.indexOf(broker.id);
                return (
                  <tr key={broker.id} className="align-middle">
                    <td className="px-4 py-3 font-mono text-slate-700">{broker.status === "PUBLISHED" ? `#${index + 1}` : "—"}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <BrokerLogo id={broker.id} name={broker.name} hasLogo={Boolean(broker.logoMime)} version={broker.logoUpdatedAt} size="sm" />
                        <div>
                          <Link href={`/admin/brokers/${broker.id}`} className="font-medium text-slate-900 hover:text-blue-700">
                            {broker.name}
                          </Link>
                          <div className="mt-0.5 flex flex-wrap gap-1.5 text-[11px] text-slate-500">
                            {broker.featured && <span className="text-amber-700">Featured</span>}
                            {broker.sponsored && <span className="text-violet-700">Sponsored</span>}
                            {broker.rating !== null && <span>Rating {broker.rating.toFixed(1)}</span>}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <Badge className={STATUS_STYLES[broker.status]}>{broker.status.charAt(0) + broker.status.slice(1).toLowerCase()}</Badge>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-600">{broker.affiliateUrl ? "Affiliate link" : "Official site"}</td>
                    <td className="px-4 py-3">
                      <BrokerRowActions
                        id={broker.id}
                        name={broker.name}
                        status={broker.status}
                        rankable={broker.status !== "ARCHIVED"}
                        isFirst={index <= 0}
                        isLast={index === group.length - 1}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
