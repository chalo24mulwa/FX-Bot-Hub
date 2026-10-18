import { db } from "@/lib/db";

export async function toggleFavorite(userId: string, productId: string): Promise<boolean> {
  // One round trip when removing (each trip to the database is ~100 ms): delete first, and only create if there was nothing to delete.
  const removed = await db.favorite.deleteMany({ where: { userId, productId } });
  if (removed.count > 0) return false;

  try {
    await db.favorite.create({ data: { userId, productId } });
  } catch (err) {
    // A concurrent double-click already created it: it is favourited either way.
    if ((err as { code?: string }).code !== "P2002") throw err;
  }
  return true;
}

export async function listFavoriteProductIds(userId: string): Promise<Set<string>> {
  const rows = await db.favorite.findMany({ where: { userId }, select: { productId: true } });
  return new Set(rows.map((r) => r.productId));
}
