import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const dynamic = "force-dynamic";

export default async function SellerDashboardPage() {
  const session = await auth();
  const sellerId = session!.user.id;

  const [total, published, pending, downloads] = await Promise.all([
    db.product.count({ where: { sellerId } }),
    db.product.count({ where: { sellerId, status: "PUBLISHED" } }),
    db.product.count({ where: { sellerId, status: "PENDING_REVIEW" } }),
    db.download.count({ where: { product: { sellerId } } }),
  ]);

  const cards = [
    { label: "Total products", value: total },
    { label: "Published", value: published },
    { label: "Pending review", value: pending },
    { label: "Total downloads", value: downloads },
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
