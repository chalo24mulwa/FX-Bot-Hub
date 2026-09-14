import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const session = await auth();
  const userId = session!.user.id;

  const [favoriteCount, licenseCount, orderCount] = await Promise.all([
    db.favorite.count({ where: { userId } }),
    db.license.count({ where: { userId } }),
    db.order.count({ where: { userId } }),
  ]);

  const cards = [
    { label: "Favorites", value: favoriteCount },
    { label: "Licenses", value: licenseCount },
    { label: "Orders", value: orderCount },
  ];

  return (
    <div>
      <h1 className="text-2xl font-semibold text-slate-900">Welcome back{session?.user.name ? `, ${session.user.name}` : ""}</h1>
      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3">
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
