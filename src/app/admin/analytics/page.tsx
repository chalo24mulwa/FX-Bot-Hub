import Link from "next/link";
import { getEventCounts, getTopSearchQueries, getTopViewedProducts } from "@/features/analytics/analytics-service";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

const RANGE_PRESETS = [
  { value: "today", label: "Today" },
  { value: "7d", label: "7 days" },
  { value: "30d", label: "30 days" },
  { value: "all", label: "All time" },
];

function getRange(preset: string): { from?: Date } {
  const now = new Date();
  switch (preset) {
    case "today":
      return { from: new Date(now.getFullYear(), now.getMonth(), now.getDate()) };
    case "7d":
      return { from: new Date(now.getTime() - 7 * 86_400_000) };
    case "30d":
      return { from: new Date(now.getTime() - 30 * 86_400_000) };
    default:
      return {};
  }
}

interface AnalyticsPageProps {
  searchParams: Promise<{ range?: string }>;
}

export default async function AdminAnalyticsPage({ searchParams }: AnalyticsPageProps) {
  const params = await searchParams;
  const preset = RANGE_PRESETS.some((p) => p.value === params.range) ? params.range! : "30d";
  const range = getRange(preset);

  const [counts, topQueries, topProducts] = await Promise.all([
    getEventCounts(range),
    getTopSearchQueries(range),
    getTopViewedProducts(range),
  ]);

  return (
    <div>
      <h1 className="text-2xl font-semibold text-slate-900">Platform analytics</h1>
      <p className="mt-1 max-w-2xl text-sm text-slate-500">
        Product views and searches are tracked here; favorites/downloads/purchases already have their own
        detailed records (Favorites, Downloads, Orders) and aren&apos;t duplicated into this table.
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
        {RANGE_PRESETS.map((p) => (
          <Link
            key={p.value}
            href={`/admin/analytics?range=${p.value}`}
            className={cn(
              "rounded-full px-3 py-1.5 text-sm font-medium",
              preset === p.value ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            )}
          >
            {p.label}
          </Link>
        ))}
      </div>

      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Stat label="Product views" value={String(counts.PRODUCT_VIEW ?? 0)} />
        <Stat label="Searches" value={String(counts.SEARCH ?? 0)} />
        <Stat label="Signal views" value={String(counts.SIGNAL_VIEW ?? 0)} />
        <Stat label="Calendar views" value={String(counts.CALENDAR_VIEW ?? 0)} />
      </div>

      <div className="mt-10 grid grid-cols-1 gap-8 lg:grid-cols-2">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Top products by views</h2>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[420px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-slate-500">
                  <th className="py-2 pr-3">Product</th>
                  <th className="py-2 pr-3 text-right">Views</th>
                  <th className="py-2 pr-3 text-right">Sales</th>
                  <th className="py-2 pr-3 text-right">Conv.</th>
                </tr>
              </thead>
              <tbody>
                {topProducts.map((p) => (
                  <tr key={p.productId} className="border-b border-slate-100">
                    <td className="py-2 pr-3 font-medium text-slate-900">
                      <Link href={`/marketplace/${p.slug}`} className="hover:underline">
                        {p.name}
                      </Link>
                    </td>
                    <td className="py-2 pr-3 text-right text-slate-600">{p.views}</td>
                    <td className="py-2 pr-3 text-right text-slate-600">{p.sales}</td>
                    <td className="py-2 pr-3 text-right text-slate-600">{(p.conversionRate * 100).toFixed(1)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {topProducts.length === 0 && <p className="py-6 text-center text-slate-500">No view data yet.</p>}
          </div>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-slate-900">Top search queries</h2>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[320px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-slate-500">
                  <th className="py-2 pr-3">Query</th>
                  <th className="py-2 pr-3 text-right">Count</th>
                </tr>
              </thead>
              <tbody>
                {topQueries.map((q) => (
                  <tr key={q.query} className="border-b border-slate-100">
                    <td className="py-2 pr-3 text-slate-900">{q.query}</td>
                    <td className="py-2 pr-3 text-right text-slate-600">{q.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {topQueries.length === 0 && <p className="py-6 text-center text-slate-500">No search data yet.</p>}
          </div>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-slate-200 p-4">
      <p className="text-xs text-slate-400">{label}</p>
      <p className="mt-1 text-xl font-semibold text-slate-900">{value}</p>
    </div>
  );
}
