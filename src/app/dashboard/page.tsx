import Link from "next/link";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { isSeller, isStaff } from "@/lib/authorization/roles";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const session = await auth();
  const userId = session!.user.id;
  const canBecomeSeller = !isSeller(session!.user.role) && !isStaff(session!.user.role);

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

      {canBecomeSeller && (
        <div className="mt-8 rounded-md border border-slate-200 bg-slate-50 p-4">
          <p className="font-medium text-slate-900">Have a trading tool to share?</p>
          <p className="mt-1 text-sm text-slate-600">
            List EAs, indicators, signals, or tools on FX Bot Market.
          </p>
          <Link href="/dashboard/become-seller" className={cn(buttonVariants({ size: "sm" }), "mt-3")}>
            Become a seller
          </Link>
        </div>
      )}
    </div>
  );
}
