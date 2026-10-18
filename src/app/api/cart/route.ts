import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireSession, withAuthorization } from "@/lib/authorization";
import { assertSameOrigin } from "@/lib/security/csrf";
import { getCartWithItems, addToCart, removeFromCart } from "@/features/cart/cart-service";

const bodySchema = z.object({ productId: z.string().cuid() });

export async function GET() {
  return withAuthorization(async () => {
    const session = await requireSession();
    const cart = await getCartWithItems(session.user.id);
    return NextResponse.json(cart);
  });
}

export async function POST(request: NextRequest) {
  return withAuthorization(async () => {
    assertSameOrigin(request);
    const session = await requireSession();
    const { productId } = bodySchema.parse(await request.json());

    try {
      await addToCart(session.user.id, productId);
      // The caller only needs to know it worked (it then opens /cart, which reads the cart itself): no second read of the whole cart.
      return NextResponse.json({ ok: true }, { status: 201 });
    } catch (err) {
      if (err instanceof Error) return NextResponse.json({ error: err.message }, { status: 400 });
      throw err;
    }
  });
}

export async function DELETE(request: NextRequest) {
  return withAuthorization(async () => {
    assertSameOrigin(request);
    const session = await requireSession();
    const { productId } = bodySchema.parse(await request.json());
    await removeFromCart(session.user.id, productId);
    return NextResponse.json({ ok: true });
  });
}
