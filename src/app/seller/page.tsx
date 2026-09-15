import Link from "next/link";
import { auth } from "@/lib/auth";
import { getSellerDashboardStats } from "@/features/seller/analytics-service";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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

interface SellerDashboardPageProps {
  searchParams: Promise<{ range?: string }>;
}

export default async function SellerDashboardPage({ searchParams }: SellerDashboardPageProps) {
  const params = await searchParams;
  const preset = RANGE_PRESETS.some((p) => p.value === params.range) ? params.range! : "all";
  const range = getRange(preset);

  const session = await auth();
  const stats = await getSellerDashboardStats(session!.user.id, range);

  const cards = [
    { label: "Total products", value: stats.totalProducts },
    { label: "Published", value: stats.published },
    { label: "Pending", value: stats.pending },
    { label: "Rejected", value: stats.rejected },
    { label: "Views", value: stats.views },
    { label: "Sales", value: stats.sales },
    { label: "Revenue", value: formatPriceCents(stats.revenueCents) },
    { label: "Downloads", value: stats.downloads },
    { label: "Favorites", value: stats.favorites },
    { label: "Ratings", value: `${stats.averageRating.toFixed(1)} (${stats.ratingCount})` },
  ];

  return (
    <div>
      <h1 className="text-2xl font-semibold text-slate-900">Overview</h1>

      <div className="mt-4 flex flex-wrap gap-2">
        {RANGE_PRESETS.map((p) => (
          <Link
            key={p.value}
            href={`/seller?range=${p.value}`}
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
