import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getCartWithItems } from "@/features/cart/cart-service";
import { RemoveFromCartButton } from "@/components/marketplace/remove-from-cart-button";
import { CheckoutButton } from "@/components/marketplace/checkout-button";
import { formatPriceCents } from "@/lib/utils";
import { ProductCover } from "@/components/marketplace/product-cover";

export const dynamic = "force-dynamic";

export default async function CartPage() {
  const session = await auth();
  if (!session?.user) redirect("/auth/sign-in?callbackUrl=/cart");

  const { items, totalCents } = await getCartWithItems(session.user.id);

  return (
    <main className="mx-auto max-w-3xl flex-1 px-6 py-12">
      <h1 className="text-2xl font-semibold text-slate-900">Your cart</h1>

      {items.length === 0 ? (
        <p className="mt-6 text-slate-500">
          Your cart is empty. <Link href="/marketplace" className="text-blue-600 hover:underline">Browse the marketplace</Link>.
        </p>
      ) : (
        <>
          <ul className="mt-6 divide-y divide-slate-100">
            {items.map((item) => (
              <li key={item.id} className="flex items-center justify-between gap-4 py-4">
                <div className="flex min-w-0 items-center gap-4">
                  <ProductCover image={item.product.images[0]} name={item.product.name} compact sizes="112px" className="h-16 w-28 rounded-md" />
                  <div>
                    <Link href={`/marketplace/${item.product.slug}`} className="font-medium text-slate-900 hover:underline">
                      {item.product.name}
                    </Link>
                    <p className="text-sm text-slate-500">Qty {item.quantity}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <span className="font-medium text-slate-900">
                    {formatPriceCents(item.product.priceCents * item.quantity, item.product.currency)}
                  </span>
                  <RemoveFromCartButton productId={item.product.id} />
                </div>
              </li>
            ))}
          </ul>

          <div className="mt-6 flex items-center justify-between border-t border-slate-200 pt-4">
            <span className="text-lg font-semibold text-slate-900">Total</span>
            <span className="text-lg font-semibold text-slate-900">{formatPriceCents(totalCents)}</span>
          </div>

          <CheckoutButton />
        </>
      )}
    </main>
  );
}
