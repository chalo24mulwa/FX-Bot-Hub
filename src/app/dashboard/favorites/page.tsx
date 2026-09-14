import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { ProductCard } from "@/components/marketplace/product-card";
import { productListInclude } from "@/repositories/product-repository";

export const dynamic = "force-dynamic";

export default async function FavoritesPage() {
  const session = await auth();
  const favorites = await db.favorite.findMany({
    where: { userId: session!.user.id },
    orderBy: { createdAt: "desc" },
    include: { product: { include: productListInclude } },
  });

  return (
    <div>
      <h1 className="text-2xl font-semibold text-slate-900">Favorites</h1>
      {favorites.length === 0 ? (
        <p className="mt-4 text-slate-500">You haven&apos;t favorited anything yet.</p>
      ) : (
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {favorites.map((fav) => (
            <ProductCard key={fav.id} product={fav.product} isFavorited />
          ))}
        </div>
      )}
    </div>
  );
}
