import { auth } from "@/lib/auth";
import { getSellerDashboardStats } from "@/features/seller/analytics-service";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatPriceCents } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function SellerDashboardPage() {
  const session = await auth();
  const stats = await getSellerDashboardStats(session!.user.id);

  const cards = [
    { label: "Total products", value: stats.totalProducts },
    { label: "Published", value: stats.published },
    { label: "Pending", value: stats.pending },
    { label: "Rejected", value: stats.rejected },
    { label: "Sales", value: stats.sales },
    { label: "Revenue", value: formatPriceCents(stats.revenueCents) },
    { label: "Downloads", value: stats.downloads },
    { label: "Ratings", value: `${stats.averageRating.toFixed(1)} (${stats.ratingCount})` },
  ];

  return (
    <div>
      <h1 className="text-2xl font-semibold text-slate-900">Overview</h1>
      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        {cards.map((card) => (
          <Card key={card.label}>
            <CardHeader>
              <CardTitle className="text-sm font-medium text-slate-500">{card.label}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-slate-900">{card.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
