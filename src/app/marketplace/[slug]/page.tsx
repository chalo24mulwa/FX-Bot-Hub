import { notFound } from "next/navigation";
import { getPublishedProductBySlug } from "@/server/services/product-service";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { cn, formatPriceCents } from "@/lib/utils";

// Product data (price, status, reviews) changes independently of any build.
export const dynamic = "force-dynamic";

interface ProductPageProps {
  params: Promise<{ slug: string }>;
}

export default async function ProductPage({ params }: ProductPageProps) {
  const { slug } = await params;
  const product = await getPublishedProductBySlug(slug);
  if (!product) notFound();

  return (
    <main className="mx-auto max-w-4xl flex-1 px-6 py-12">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold text-slate-900">{product.name}</h1>
            <Badge>{product.type.replace("_", " ")}</Badge>
            <Badge>{product.platform}</Badge>
          </div>
          <p className="mt-1 text-sm text-slate-500">by {product.vendor.name}</p>
        </div>
        <button className={cn(buttonVariants())}>
          Buy — {formatPriceCents(product.priceCents, product.currency)}
        </button>
      </div>

      <p className="mt-6 text-slate-700">{product.shortSummary}</p>
      <div className="prose mt-6 max-w-none whitespace-pre-wrap text-slate-700">
        {product.description}
      </div>

      <section className="mt-10">
        <h2 className="text-lg font-semibold text-slate-900">Reviews</h2>
        {product.reviews.length === 0 ? (
          <p className="mt-2 text-sm text-slate-500">No reviews yet.</p>
        ) : (
          <ul className="mt-4 space-y-4">
            {product.reviews.map((review) => (
              <li key={review.id} className="border-b border-slate-200 pb-4">
                <p className="font-medium text-slate-900">
                  {review.user.name} — {review.rating}/5
                </p>
                {review.body && <p className="mt-1 text-sm text-slate-600">{review.body}</p>}
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
