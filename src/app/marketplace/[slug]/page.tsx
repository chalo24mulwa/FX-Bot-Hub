import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPublishedProductBySlug } from "@/server/services/product-service";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { FavoriteButton } from "@/components/marketplace/favorite-button";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { cn, formatPriceCents } from "@/lib/utils";

// Product data (price, status, reviews) changes independently of any build.
export const dynamic = "force-dynamic";

interface ProductPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: ProductPageProps): Promise<Metadata> {
  const { slug } = await params;
  const product = await getPublishedProductBySlug(slug);
  if (!product) return {};

  return {
    title: product.name,
    description: product.shortSummary,
    alternates: { canonical: `/marketplace/${product.slug}` },
    openGraph: {
      title: product.name,
      description: product.shortSummary,
      type: "website",
    },
  };
}

export default async function ProductPage({ params }: ProductPageProps) {
  const { slug } = await params;
  const [product, session] = await Promise.all([getPublishedProductBySlug(slug), auth()]);
  if (!product) notFound();

  const isFavorited = session?.user
    ? Boolean(
        await db.favorite.findUnique({
          where: { userId_productId: { userId: session.user.id, productId: product.id } },
        })
      )
    : false;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    description: product.shortSummary,
    brand: { "@type": "Organization", name: product.seller.name ?? "FX Bot Market seller" },
    aggregateRating: product.rating
      ? {
          "@type": "AggregateRating",
          ratingValue: product.rating.average,
          reviewCount: product.rating.count,
        }
      : undefined,
    offers: {
      "@type": "Offer",
      price: (product.priceCents / 100).toFixed(2),
      priceCurrency: product.currency,
      availability: "https://schema.org/InStock",
    },
  };

  return (
    <main className="mx-auto max-w-4xl flex-1 px-6 py-12">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold text-slate-900">{product.name}</h1>
            {product.featured && <Badge className="border-amber-300 bg-amber-50 text-amber-800">Featured</Badge>}
            <Badge>{product.type.replace("_", " ")}</Badge>
            <Badge>{product.platform.replace("_", " ")}</Badge>
          </div>
          <div className="mt-1 flex items-center gap-2 text-sm text-slate-500">
            <span>by {product.seller.name}</span>
            {product.seller.sellerProfile?.verified && <span className="text-blue-600">✓ Verified</span>}
            {product.rating && (
              <span>
                · ★ {product.rating.average.toFixed(1)} ({product.rating.count} review
                {product.rating.count === 1 ? "" : "s"})
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <FavoriteButton productId={product.id} initialFavorited={isFavorited} className="static bg-white" />
          <button className={cn(buttonVariants())}>
            {product.pricingType === "FREE" ? "Get for free" : `Buy — ${formatPriceCents(product.priceCents, product.currency)}`}
          </button>
        </div>
      </div>

      <p className="mt-6 text-slate-700">{product.shortSummary}</p>
      <div className="prose mt-6 max-w-none whitespace-pre-wrap text-slate-700">
        {product.description}
      </div>

      {product.documentation.length > 0 && (
        <section className="mt-10">
          <h2 className="text-lg font-semibold text-slate-900">Documentation</h2>
          <ul className="mt-3 space-y-3">
            {product.documentation.map((doc) => (
              <li key={doc.id}>
                <p className="font-medium text-slate-900">{doc.title}</p>
                {doc.contentMarkdown && (
                  <p className="mt-1 whitespace-pre-wrap text-sm text-slate-600">{doc.contentMarkdown}</p>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

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
