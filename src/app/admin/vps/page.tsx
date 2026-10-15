import Link from "next/link";
import type { VpsStatus } from "@prisma/client";
import { requireAdminPage } from "@/features/admin/viewer";
import { countVpsByStatus, listVpsForAdmin } from "@/features/vps/queries";
import { VpsLogo } from "@/components/vps/vps-image";
import { VpsRowActions } from "@/components/admin/vps-row-actions";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

const STATUS_STYLES: Record<VpsStatus, string> = {
  PUBLISHED: "border-emerald-200 bg-emerald-50 text-emerald-800",
  DRAFT: "border-slate-200 bg-slate-50 text-slate-700",
  ARCHIVED: "border-amber-200 bg-amber-50 text-amber-800",
};

function parseStatus(value: unknown): VpsStatus | undefined {
  return value === "PUBLISHED" || value === "DRAFT" || value === "ARCHIVED" ? value : undefined;
}

export default async function AdminVpsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireAdminPage("vps:manage");
  const status = parseStatus((await searchParams).status);
  const [providers, counts, published, drafts] = await Promise.all([listVpsForAdmin(status), countVpsByStatus(), listVpsForAdmin("PUBLISHED"), listVpsForAdmin("DRAFT")]);
  const publishedIds = published.map((p) => p.id);
  const draftIds = drafts.map((p) => p.id);
  const total = counts.DRAFT + counts.PUBLISHED + counts.ARCHIVED;

  const tabs: { key: VpsStatus | undefined; label: string; count: number }[] = [
    { key: undefined, label: "All", count: total },
    { key: "PUBLISHED", label: "Published", count: counts.PUBLISHED },
    { key: "DRAFT", label: "Drafts", count: counts.DRAFT },
    { key: "ARCHIVED", label: "Archived", count: counts.ARCHIVED },
  ];

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Manage VPS Providers</h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-600">
            Manage the providers shown at <Link href="/vps" className="text-blue-600 hover:underline">/vps</Link>. Only published providers are public; their order here is their public ranking. Enter only information you have verified.
          </p>
        </div>
        <Link href="/admin/vps/new" className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800">
          Add provider
        </Link>
      </div>

      <nav aria-label="Filter by status" className="mt-5 flex flex-wrap gap-2">
        {tabs.map((tab) => (
          <Link
            key={tab.label}
            href={tab.key ? `/admin/vps?status=${tab.key}` : "/admin/vps"}
            aria-current={status === tab.key ? "page" : undefined}
            className={cn("rounded-full border px-3 py-1 text-sm", status === tab.key ? "border-slate-900 bg-slate-900 text-white" : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50")}
          >
            {tab.label} <span className="opacity-70">{tab.count}</span>
          </Link>
        ))}
      </nav>

      {providers.length === 0 ? (
        <p className="mt-8 rounded-lg border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-600">
          {total === 0 ? "No providers yet. Add the first one — it stays a draft until you publish it." : "No providers with that status."}
        </p>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="w-full min-w-[44rem] text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th scope="col" className="px-4 py-3">Public rank</th>
                <th scope="col" className="px-4 py-3">Provider</th>
                <th scope="col" className="px-4 py-3">Status</th>
                <th scope="col" className="px-4 py-3">Link</th>
                <th scope="col" className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {providers.map((p) => {
                const group = p.status === "PUBLISHED" ? publishedIds : p.status === "DRAFT" ? draftIds : [];
                const index = group.indexOf(p.id);
                return (
                  <tr key={p.id} className="align-middle">
                    <td className="px-4 py-3 font-mono text-slate-700">{p.status === "PUBLISHED" ? `#${index + 1}` : "—"}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <VpsLogo id={p.id} name={p.name} hasLogo={Boolean(p.logoMime)} version={p.logoUpdatedAt} size="sm" />
                        <div>
                          <Link href={`/admin/vps/${p.id}`} className="font-medium text-slate-900 hover:text-blue-700">{p.name}</Link>
                          <div className="mt-0.5 flex flex-wrap gap-1.5 text-[11px] text-slate-500">
                            {p.featured && <span className="text-amber-700">Top Pick</span>}
                            {p.sponsored && <span className="text-violet-700">Sponsored</span>}
                            {p.rating !== null && <span>Rating {p.rating.toFixed(1)}</span>}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <Badge className={STATUS_STYLES[p.status]}>{p.status.charAt(0) + p.status.slice(1).toLowerCase()}</Badge>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-600">{p.affiliateUrl ? "Affiliate link" : "Official site"}</td>
                    <td className="px-4 py-3">
                      <VpsRowActions id={p.id} name={p.name} status={p.status} rankable={p.status !== "ARCHIVED"} isFirst={index <= 0} isLast={index === group.length - 1} />
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
