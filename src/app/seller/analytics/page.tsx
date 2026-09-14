import { auth } from "@/lib/auth";
import { getSellerProductAnalytics } from "@/features/seller/analytics-service";
import { formatPriceCents } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function SellerAnalyticsPage() {
  const session = await auth();
  const rows = await getSellerProductAnalytics(session!.user.id);

  return (
    <div>
      <h1 className="text-2xl font-semibold text-slate-900">Product analytics</h1>

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
