import { db } from "@/lib/db";
import { productListInclude } from "@/repositories/product-repository";

async function getOrCreateCart(userId: string) {
  return db.cart.upsert({
    where: { userId },
    update: {},
    create: { userId },
  });
}

export async function getCartWithItems(userId: string) {
  const cart = await getOrCreateCart(userId);
  const items = await db.cartItem.findMany({
    where: { cartId: cart.id },
    orderBy: { createdAt: "asc" },
    include: { product: { include: productListInclude } },
  });
  const totalCents = items.reduce((sum, item) => sum + item.product.priceCents * item.quantity, 0);
  return { cart, items, totalCents };
}

export async function addToCart(userId: string, productId: string) {
  const product = await db.product.findUnique({ where: { id: productId }, select: { status: true } });
  if (!product || product.status !== "PUBLISHED") {
    throw new Error("Product is not available for purchase.");
  }

  const cart = await getOrCreateCart(userId);
  return db.cartItem.upsert({
    where: { cartId_productId: { cartId: cart.id, productId } },
    update: {},
    create: { cartId: cart.id, productId, quantity: 1 },
  });
}

export async function removeFromCart(userId: string, productId: string) {
  const cart = await getOrCreateCart(userId);
  await db.cartItem.deleteMany({ where: { cartId: cart.id, productId } });
}

export async function clearCart(userId: string) {
  const cart = await getOrCreateCart(userId);
  await db.cartItem.deleteMany({ where: { cartId: cart.id } });
}
