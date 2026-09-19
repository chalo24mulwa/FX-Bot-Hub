import Link from "next/link";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { Badge } from "@/components/ui/badge";
import { formatPriceCents } from "@/lib/utils";
import { ProductCover } from "@/components/marketplace/product-cover";
import { productCoverSelect } from "@/repositories/product-repository";
import { ProductSubscriptionRowActions } from "@/components/commerce/product-subscription-row-actions";

export const dynamic = "force-dynamic";

export default async function ProductSubscriptionsPage() {
  const session = await auth();
  const subscriptions = await db.subscription.findMany({
    where: { userId: session!.user.id },
    orderBy: { createdAt: "desc" },
    include: { product: { select: { name: true, slug: true, priceCents: true, currency: true, images: productCoverSelect } } },
  });

  return (
    <div>
      <h1 className="text-2xl font-semibold text-slate-900">Product subscriptions</h1>

      {subscriptions.length === 0 ? (
        <p className="mt-4 text-slate-500">
          No product subscriptions yet. <Link href="/marketplace" className="text-blue-600 hover:underline">Browse the marketplace</Link>.
        </p>
      ) : (
        <ul className="mt-4 divide-y divide-slate-100">
          {subscriptions.map((sub) => (
            <li key={sub.id} className="flex items-center justify-between gap-4 py-3">
              <div className="flex min-w-0 items-center gap-3">
                <ProductCover image={sub.product.images[0]} name={sub.product.name} compact sizes="80px" className="h-12 w-20 rounded" />
                <div>
                  <Link href={`/marketplace/${sub.product.slug}`} className="font-medium text-slate-900 hover:underline">
                    {sub.product.name}
                  </Link>
                  <div className="mt-1 flex items-center gap-2 text-xs text-slate-500">
                    <Badge>{sub.status}</Badge>
                    <span>{formatPriceCents(sub.product.priceCents, sub.product.currency)}/mo</span>
                    {sub.currentPeriodEnd && (
                      <span>
                        {sub.cancelAtPeriodEnd ? "ends" : "renews"} {sub.currentPeriodEnd.toLocaleDateString()}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <ProductSubscriptionRowActions
                subscriptionId={sub.id}
                status={sub.status}
                cancelAtPeriodEnd={sub.cancelAtPeriodEnd}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
