import { db } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const dynamic = "force-dynamic";

async function getStats() {
  const [userCount, sellerCount, productCounts, orderCount, pendingReviews] = await Promise.all([
    db.user.count(),
    db.user.count({ where: { role: { in: ["SELLER", "AUTHOR"] } } }),
    db.product.groupBy({ by: ["status"], _count: true }),
    db.order.count({ where: { status: "PAID" } }),
    db.product.count({ where: { status: "PENDING_REVIEW" } }),
  ]);

  const published = productCounts.find((p) => p.status === "PUBLISHED")?._count ?? 0;

  return { userCount, sellerCount, published, orderCount, pendingReviews };
}

export default async function AdminDashboardPage() {
  const stats = await getStats();

  const cards = [
    { label: "Total users", value: stats.userCount },
    { label: "Sellers", value: stats.sellerCount },
    { label: "Published products", value: stats.published },
    { label: "Paid orders", value: stats.orderCount },
    { label: "Pending review", value: stats.pendingReviews },
  ];

  return (
    <div>
      <h1 className="text-2xl font-semibold text-slate-900">Dashboard</h1>
      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
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
