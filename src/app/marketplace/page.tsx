import Link from "next/link";
import { listProductsQuerySchema } from "@/lib/validations/product";
import { listPublishedProducts } from "@/server/services/product-service";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatPriceCents } from "@/lib/utils";

// Listings + search params vary per request; never prerender statically.
export const dynamic = "force-dynamic";

interface MarketplacePageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function MarketplacePage({ searchParams }: MarketplacePageProps) {
  const params = await searchParams;
  const query = listProductsQuerySchema.parse(params);
  const { items, total } = await listPublishedProducts(query);

  return (
    <main className="mx-auto max-w-6xl flex-1 px-6 py-12">
      <h1 className="text-2xl font-semibold text-slate-900">Marketplace</h1>
      <p className="mt-1 text-sm text-slate-500">{total} product{total === 1 ? "" : "s"}</p>

      {items.length === 0 ? (
        <p className="mt-8 text-slate-500">
          No products published yet. Seed the database with{" "}
          <code className="rounded bg-slate-100 px-1 py-0.5">npx prisma db seed</code>.
        </p>
      ) : (
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((product) => (
            <Link key={product.id} href={`/marketplace/${product.slug}`}>
              <Card className="h-full transition-shadow hover:shadow-md">
                <CardHeader>
                  <div className="flex items-center justify-between gap-2">
                    <CardTitle>{product.name}</CardTitle>
                    <Badge>{product.type.replace("_", " ")}</Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="line-clamp-2 text-sm text-slate-600">{product.shortSummary}</p>
                  <p className="mt-3 font-medium text-slate-900">
                    {formatPriceCents(product.priceCents, product.currency)}
                  </p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
