import { db } from "@/lib/db";

export async function toggleFavorite(userId: string, productId: string): Promise<boolean> {
  const existing = await db.favorite.findUnique({
    where: { userId_productId: { userId, productId } },
  });

  if (existing) {
    await db.favorite.delete({ where: { id: existing.id } });
    return false;
  }

  await db.favorite.create({ data: { userId, productId } });
  return true;
}

export async function listFavoriteProductIds(userId: string): Promise<Set<string>> {
  const rows = await db.favorite.findMany({ where: { userId }, select: { productId: true } });
  return new Set(rows.map((r) => r.productId));
}
