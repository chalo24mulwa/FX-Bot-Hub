import { db } from "@/lib/db";
import { productCoverSelect } from "@/repositories/product-repository";

// Prisma runs an upsert as several statements inside a transaction (each a ~100 ms round trip to the database); the common case here is
// "the cart already exists", which is one plain read.
async function getOrCreateCart(userId: string) {
  const existing = await db.cart.findUnique({ where: { userId } });
  if (existing) return existing;
  try {
    return await db.cart.create({ data: { userId } });
  } catch (err) {
    // Two first-time requests at once: the other one created it.
    if ((err as { code?: string }).code === "P2002") return db.cart.findUniqueOrThrow({ where: { userId } });
    throw err;
  }
}

// What the cart page and checkout need from each product — not the full listing include.
const cartProductSelect = {
  id: true,
  slug: true,
  name: true,
  priceCents: true,
  currency: true,
  pricingType: true,
  images: productCoverSelect,
} as const;

export async function getCartWithItems(userId: string) {
  // One statement: the cart, its items, each product and its cover. (A missing cart is created on first use, which costs one more trip.)
  let found = await db.cart.findUnique({
    where: { userId },
    relationLoadStrategy: "join",
    include: { items: { orderBy: { createdAt: "asc" }, include: { product: { select: cartProductSelect } } } },
  });
  if (!found) {
    await getOrCreateCart(userId);
    found = await db.cart.findUniqueOrThrow({
      where: { userId },
      relationLoadStrategy: "join",
      include: { items: { orderBy: { createdAt: "asc" }, include: { product: { select: cartProductSelect } } } },
    });
  }
  const { items: cartItems, ...cart } = found;
  const items = cartItems;
  const totalCents = items.reduce((sum, item) => sum + item.product.priceCents * item.quantity, 0);
  return { cart, items, totalCents };
}

export async function addToCart(userId: string, productId: string) {
  // The product check and the cart lookup are independent: run them together (one round trip instead of two).
  const [product, cart] = await Promise.all([
    db.product.findUnique({ where: { id: productId }, select: { status: true } }),
    getOrCreateCart(userId),
  ]);
  if (!product || product.status !== "PUBLISHED") {
    throw new Error("Product is not available for purchase.");
  }
  // INSERT ... ON CONFLICT DO NOTHING: adding the same product twice is a no-op, in a single statement.
  await db.cartItem.createMany({ data: [{ cartId: cart.id, productId, quantity: 1 }], skipDuplicates: true });
}

export async function removeFromCart(userId: string, productId: string) {
  // One statement; filtering through the cart's owner means there is no cart lookup (or creation) first.
  await db.cartItem.deleteMany({ where: { productId, cart: { userId } } });
}

export async function clearCart(userId: string) {
  await db.cartItem.deleteMany({ where: { cart: { userId } } });
}
