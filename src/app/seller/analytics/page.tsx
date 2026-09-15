import Link from "next/link";
import { auth } from "@/lib/auth";
import { getSellerProductAnalytics } from "@/features/seller/analytics-service";
import { formatPriceCents, cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

const RANGE_PRESETS = [
  { value: "7d", label: "7 days" },
  { value: "30d", label: "30 days" },
  { value: "90d", label: "90 days" },
  { value: "all", label: "All time" },
];

function getRange(preset: string): { from?: Date } {
  const now = new Date();
  switch (preset) {
    case "7d":
      return { from: new Date(now.getTime() - 7 * 86_400_000) };
    case "30d":
      return { from: new Date(now.getTime() - 30 * 86_400_000) };
    case "90d":
      return { from: new Date(now.getTime() - 90 * 86_400_000) };
    default:
      return {};
  }
}

interface SellerAnalyticsPageProps {
  searchParams: Promise<{ range?: string }>;
}

export default async function SellerAnalyticsPage({ searchParams }: SellerAnalyticsPageProps) {
  const params = await searchParams;
  const preset = RANGE_PRESETS.some((p) => p.value === params.range) ? params.range! : "all";
  const range = getRange(preset);

  const session = await auth();
  const rows = await getSellerProductAnalytics(session!.user.id, range);

  return (
    <div>
      <h1 className="text-2xl font-semibold text-slate-900">Product analytics</h1>

      <div className="mt-4 flex flex-wrap gap-2">
        {RANGE_PRESETS.map((p) => (
          <Link
            key={p.value}
            href={`/seller/analytics?range=${p.value}`}
            className={cn(
              "rounded-full px-3 py-1.5 text-sm font-medium",
              preset === p.value ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            )}
          >
            {p.label}
          </Link>
        ))}
      </div>
      {preset !== "all" && (
        <p className="mt-2 text-xs text-slate-400">
          Views in a date range count tracked page views since analytics tracking went live — older view
          history only exists as an all-time total, shown under &quot;All time&quot;.
        </p>
      )}

      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[720px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-slate-500">
              <th className="py-2 pr-4">Product</th>
              <th className="py-2 pr-4">Views</th>
              <th className="py-2 pr-4">Favorites</th>
              <th className="py-2 pr-4">Sales</th>
              <th className="py-2 pr-4">Revenue</th>
              <th className="py-2 pr-4">Downloads</th>
              <th className="py-2 pr-4">Conversion</th>
              <th className="py-2 pr-4">Rating</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.productId} className="border-b border-slate-100">
                <td className="py-2 pr-4 font-medium text-slate-900">{row.name}</td>
                <td className="py-2 pr-4 text-slate-600">{row.views}</td>
                <td className="py-2 pr-4 text-slate-600">{row.favorites}</td>
                <td className="py-2 pr-4 text-slate-600">{row.sales}</td>
                <td className="py-2 pr-4 text-slate-600">{formatPriceCents(row.revenueCents)}</td>
                <td className="py-2 pr-4 text-slate-600">{row.downloads}</td>
                <td className="py-2 pr-4 text-slate-600">{(row.conversionRate * 100).toFixed(1)}%</td>
                <td className="py-2 pr-4 text-slate-600">
                  {row.rating.toFixed(1)} ({row.reviewCount})
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && <p className="py-8 text-center text-slate-500">No products yet.</p>}
      </div>
    </div>
  );
}
