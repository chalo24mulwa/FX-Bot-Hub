import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Image from "next/image";
import { getPublishedProductBySlug, incrementProductView } from "@/server/services/product-service";
import { checkEntitlement } from "@/features/downloads/entitlement-service";
import { Badge } from "@/components/ui/badge";
import { ProductCover } from "@/components/marketplace/product-cover";
import { FavoriteButton } from "@/components/marketplace/favorite-button";
import { AddToCartButton } from "@/components/marketplace/add-to-cart-button";
import { ContactSellerButton } from "@/components/marketplace/contact-seller-button";
import { ReviewForm } from "@/components/marketplace/review-form";
import { StarRating } from "@/components/marketplace/star-rating";
import { canReviewProduct } from "@/features/reviews/review-service";
import { ProductTabs } from "@/components/marketplace/product-tabs";
import { PartnershipInlineLink } from "@/components/partnership/partnership-cta";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getPublicUrl } from "@/lib/storage";
import { formatPriceCents } from "@/lib/utils";
import { priceDisplay } from "@/lib/pricing/discount";
import { track } from "@/lib/analytics/track";
import { computeQualityScore, isRecentlyUpdated } from "@/lib/quality/product-quality";

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
      images: product.images[0] ? [getPublicUrl(product.images[0].storageKey)] : undefined,
    },
  };
}

export default async function ProductPage({ params }: ProductPageProps) {
  const { slug } = await params;
  const [product, session] = await Promise.all([getPublishedProductBySlug(slug), auth()]);
  if (!product) notFound();

  void incrementProductView(product.id);
  void track({ type: "PRODUCT_VIEW", userId: session?.user.id, productId: product.id });

  const [isFavorited, entitlement, reviewPermission, ownReview] = await Promise.all([
    session?.user
      ? db.favorite
          .findUnique({ where: { userId_productId: { userId: session.user.id, productId: product.id } } })
          .then(Boolean)
      : Promise.resolve(false),
    session?.user
      ? checkEntitlement(session.user.id, session.user.role, product.id)
      : Promise.resolve({ entitled: false, reason: "not_entitled" as const }),
    session?.user ? canReviewProduct(session.user.id, product.id) : Promise.resolve(null),
    session?.user
      ? db.review.findUnique({ where: { productId_userId: { productId: product.id, userId: session.user.id } }, select: { rating: true, title: true, body: true } })
      : Promise.resolve(null),
  ]);

  const latestVersion = product.versions[0];

  // The stored summary is the source of truth; if a product has reviews but no summary row yet (older data), derive it from them
  // instead of showing "Not yet rated" next to a list of reviews.
  const ratingStats = (() => {
    if (product.rating && product.rating.count > 0) {
      const r = product.rating;
      return { average: r.average, count: r.count, stars: [r.star1, r.star2, r.star3, r.star4, r.star5] };
    }
    const values = product.reviews.map((r) => r.rating);
    const stars = [1, 2, 3, 4, 5].map((n) => values.filter((v) => v === n).length);
    return { average: values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0, count: values.length, stars };
  })();
  // The cover photo renders above the title (top of the page) when the
  // seller has uploaded one — see ProductCover.
  const cover = product.images[0];
  const price = priceDisplay(product);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    description: product.shortSummary,
    image: cover ? getPublicUrl(cover.storageKey) : undefined,
    brand: { "@type": "Organization", name: product.seller.name ?? "fx Bot Hub seller" },
    aggregateRating: product.rating
      ? { "@type": "AggregateRating", ratingValue: product.rating.average, reviewCount: product.rating.count }
      : undefined,
    offers: {
      "@type": "Offer",
      price: (product.priceCents / 100).toFixed(2),
      priceCurrency: product.currency,
      availability: "https://schema.org/InStock",
    },
  };


  // Precise version of the ranking's approximate quality signal (see
  // src/lib/ranking/ranking-service.ts) — full review rows are already
  // loaded here, so "verified reviews" can check verifiedPurchase exactly
  // instead of just "has any review." A checklist of completeness/trust
  // signals only — never a claim this product is profitable or safe to
  // trade, see the copy right below it.
  const quality = computeQualityScore({
    hasDocumentation: product.documentation.length > 0,
    hasScreenshots: product.screenshots.length > 0,
    hasCompatibilityInfo: Boolean(product.compatibilityNotes?.trim()),
    recentlyUpdated: isRecentlyUpdated(product.updatedAt),
    verifiedSeller: product.seller.sellerProfile?.verified ?? false,
    hasVerifiedReviews: product.reviews.some((r) => r.verifiedPurchase),
  });
  const QUALITY_LABELS: Record<keyof typeof quality.signals, string> = {
    hasDocumentation: "Documentation",
    hasScreenshots: "Screenshots",
    hasCompatibilityInfo: "Compatibility info",
    recentlyUpdated: "Recently updated",
    verifiedSeller: "Verified developer",
    hasVerifiedReviews: "Verified purchase reviews",
  };

  return (
    <main className="mx-auto max-w-4xl flex-1 px-6 py-12">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      {cover && (
        <ProductCover
          image={cover}
          name={product.name}
          priority
          sizes="(min-width: 896px) 896px, 100vw"
          className="mb-6 aspect-[16/9] w-full rounded-lg"
          discountPercent={price.percent}
        />
      )}

      <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold text-slate-900">{product.name}</h1>
            {product.featured && <Badge className="border-amber-300 bg-amber-50 text-amber-800">Featured</Badge>}
            <Badge>{product.type.replace("_", " ")}</Badge>
            <Badge>{product.platform.replace("_", " ")}</Badge>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-slate-500">
            <span>by {product.seller.name}</span>
            {product.seller.sellerProfile?.verified && <span className="text-blue-600">✓ Verified</span>}
            {latestVersion && <span>· v{latestVersion.version}</span>}
            <span>· Updated {product.updatedAt.toLocaleDateString()}</span>
          </div>
          <div className="mt-2">
            <a href="#reviews" className="inline-flex rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400" aria-label="Jump to reviews">
              <StarRating average={ratingStats.average} count={ratingStats.count} size="md" />
            </a>
          </div>
        </div>

        <div className="flex flex-col items-start gap-2 sm:items-end">
          {!price.free && (
            <p className="flex flex-wrap items-baseline gap-2" data-testid="detail-price">
              <span className="text-2xl font-semibold text-slate-900">
                {formatPriceCents(price.offerCents, product.currency)}
                {product.pricingType === "SUBSCRIPTION" && <span className="text-sm font-normal text-slate-500"> /mo</span>}
              </span>
              {price.marketCents !== null && (
                <>
                  <span className="text-base text-slate-400 line-through">
                    <span className="sr-only">Original price </span>
                    {formatPriceCents(price.marketCents, product.currency)}
                  </span>
                  <span className="rounded bg-red-600 px-1.5 py-0.5 text-xs font-bold text-white">{price.percent}% OFF</span>
                </>
              )}
            </p>
          )}
          <div className="flex items-center gap-2">
            <FavoriteButton productId={product.id} initialFavorited={isFavorited} className="static bg-white" />
            {entitlement.entitled ? (
              <span className="text-sm font-medium text-emerald-700">
                {entitlement.reason === "subscribed" ? "You're subscribed" : "You own this product"}
              </span>
            ) : (
              <AddToCartButton
                productId={product.id}
                label={
                  product.pricingType === "FREE"
                    ? "Get for free"
                    : product.pricingType === "SUBSCRIPTION"
                      ? `Subscribe — ${formatPriceCents(product.priceCents, product.currency)}/mo`
                      : `Buy — ${formatPriceCents(product.priceCents, product.currency)}`
                }
              />
            )}
          </div>
          <ContactSellerButton productId={product.id} />
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-1.5">
        <span className="text-xs text-slate-400">
          Quality signals ({quality.metCount}/{quality.totalCount}):
        </span>
        {(Object.keys(quality.signals) as (keyof typeof quality.signals)[]).map((key) => (
          <Badge
            key={key}
            className={
              quality.signals[key]
                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                : "border-slate-200 bg-slate-50 text-slate-400"
            }
          >
            {quality.signals[key] ? "✓" : "–"} {QUALITY_LABELS[key]}
          </Badge>
        ))}
      </div>
      <p className="mt-1 text-xs text-slate-400">
        These reflect listing completeness and trust signals only — not a claim about trading performance,
        profitability, or safety.
      </p>

      {entitlement.entitled && latestVersion && latestVersion.files.length > 0 && (
        <div className="mt-6 rounded-md border border-emerald-200 bg-emerald-50 p-4">
          <p className="text-sm font-medium text-emerald-900">Your downloads</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {latestVersion.files.map((file) => (
              <a
                key={file.id}
                href={`/api/downloads/${file.id}`}
                className="rounded-md border border-emerald-300 bg-white px-3 py-1.5 text-sm font-medium text-emerald-800 hover:bg-emerald-100"
              >
                Download {file.fileName} ({file.platform})
              </a>
            ))}
          </div>
        </div>
      )}

      <ProductTabs
        tabs={[
          {
            id: "overview",
            label: "Overview",
            content: (
              <div className="whitespace-pre-wrap text-slate-700">
                <p className="mb-4 font-medium text-slate-900">{product.shortSummary}</p>
                {product.description}
                {product.screenshots.length > 0 && (
                  <div className="mt-6 flex flex-wrap gap-3">
                    {product.screenshots.map((s) => (
                      <div key={s.id} className="relative h-32 w-48 overflow-hidden rounded border border-slate-200">
                        <Image src={getPublicUrl(s.storageKey)} alt={s.caption ?? ""} fill className="object-cover" />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ),
          },
          {
            id: "features",
            label: "Features",
            content:
              product.features.length === 0 ? (
                <p className="text-sm text-slate-500">No features listed.</p>
              ) : (
                <ul className="list-disc space-y-1 pl-5 text-slate-700">
                  {product.features.map((f, i) => (
                    <li key={i}>{f}</li>
                  ))}
                </ul>
              ),
          },
          {
            id: "documentation",
            label: "Documentation",
            content: (
              <div className="space-y-4">
                {product.compatibilityNotes && (
                  <div>
                    <p className="font-medium text-slate-900">Compatibility</p>
                    <p className="whitespace-pre-wrap text-sm text-slate-600">{product.compatibilityNotes}</p>
                  </div>
                )}
                {product.installationInstructions && (
                  <div>
                    <p className="font-medium text-slate-900">Installation</p>
                    <p className="whitespace-pre-wrap text-sm text-slate-600">{product.installationInstructions}</p>
                  </div>
                )}
                {product.documentation.length === 0 ? (
                  <p className="text-sm text-slate-500">No additional documentation.</p>
                ) : (
                  product.documentation.map((doc) => (
                    <div key={doc.id}>
                      <p className="font-medium text-slate-900">{doc.title}</p>
                      {doc.contentMarkdown && (
                        <p className="whitespace-pre-wrap text-sm text-slate-600">{doc.contentMarkdown}</p>
                      )}
                      {doc.storageKey && (
                        <a href={getPublicUrl(doc.storageKey)} className="text-sm text-blue-600 hover:underline">
                          View attachment
                        </a>
                      )}
                    </div>
                  ))
                )}
              </div>
            ),
          },
          {
            id: "reviews",
            label: "Reviews",
            content: (
              <div>
                <div className="flex flex-wrap items-center gap-x-8 gap-y-3" data-testid="rating-summary">
                  <div className="flex flex-col items-start gap-1">
                    {ratingStats.count > 0 && <p className="text-3xl font-semibold text-slate-900">{ratingStats.average.toFixed(1)}<span className="text-base font-normal text-slate-400"> / 5</span></p>}
                    <StarRating average={ratingStats.average} count={ratingStats.count} size="lg" showText={false} />
                    <p className="text-sm text-slate-500">
                      {ratingStats.count > 0 ? `${ratingStats.count} review${ratingStats.count === 1 ? "" : "s"}` : "Not yet rated — no one has reviewed this product yet."}
                    </p>
                  </div>
                  {ratingStats.count > 0 && (
                    <ul className="flex min-w-[12rem] flex-1 flex-col gap-1 text-xs text-slate-600" aria-label="Rating breakdown">
                      {[5, 4, 3, 2, 1].map((n) => (
                        <li key={n} className="flex items-center gap-2">
                          <span className="w-10 shrink-0">{n} star{n === 1 ? "" : "s"}</span>
                          <span className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
                            <span className="block h-full rounded-full bg-amber-500" style={{ width: `${(ratingStats.stars[n - 1] / ratingStats.count) * 100}%` }} />
                          </span>
                          <span className="w-6 shrink-0 text-right tabular-nums">{ratingStats.stars[n - 1]}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <div className="mt-5">
                  {!session?.user ? (
                    <p className="text-sm text-slate-600">
                      <a href="/auth/sign-in" className="text-blue-600 underline">Sign in</a> to rate this product once you&apos;ve bought it.
                    </p>
                  ) : reviewPermission?.allowed ? (
                    <ReviewForm key={ownReview ? `edit-${ownReview.rating}` : "new"} productId={product.id} initial={ownReview ?? undefined} />
                  ) : (
                    <p className="text-sm text-slate-500" data-testid="review-not-allowed">
                      {reviewPermission?.reason === "owner"
                        ? "You can't rate your own product."
                        : "Only customers who bought or got this product can rate it."}
                    </p>
                  )}
                </div>
                {product.reviews.length === 0 ? (
                  <p className="mt-4 text-sm text-slate-500">No reviews yet.</p>
                ) : (
                  <ul className="mt-4 space-y-4">
                    {product.reviews.map((review) => (
                      <li key={review.id} className="border-b border-slate-200 pb-4">
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-slate-900">{review.user.name}</p>
                          <StarRating average={review.rating} count={1} showText={false} />
                          <span className="sr-only">{review.rating} out of 5</span>
                          {review.verifiedPurchase && (
                            <Badge className="border-emerald-300 bg-emerald-50 text-emerald-800">
                              Verified purchase
                            </Badge>
                          )}
                        </div>
                        {review.title && <p className="mt-1 font-medium text-slate-800">{review.title}</p>}
                        {review.body && <p className="mt-1 text-sm text-slate-600">{review.body}</p>}
                        {review.sellerResponse && (
                          <div className="mt-2 rounded-md bg-slate-50 p-2 text-sm text-slate-600">
                            <p className="font-medium text-slate-700">Seller response</p>
                            {review.sellerResponse}
                          </div>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ),
          },
          {
            id: "changelog",
            label: "Changelog",
            content:
              product.versions.length === 0 ? (
                <p className="text-sm text-slate-500">No versions published yet.</p>
              ) : (
                <ul className="space-y-4">
                  {product.versions.map((v) => (
                    <li key={v.id}>
                      <p className="font-medium text-slate-900">
                        v{v.version} <span className="text-xs font-normal text-slate-400">{v.createdAt.toLocaleDateString()}</span>
                      </p>
                      {v.changelog && <p className="whitespace-pre-wrap text-sm text-slate-600">{v.changelog}</p>}
                    </li>
                  ))}
                </ul>
              ),
          },
          {
            id: "support",
            label: "Support",
            content: (
              <div className="space-y-4">
                {product.supportInfo ? (
                  <p className="whitespace-pre-wrap text-sm text-slate-600">{product.supportInfo}</p>
                ) : (
                  <p className="text-sm text-slate-500">No support information provided.</p>
                )}
                {product.requirements && (
                  <div>
                    <p className="font-medium text-slate-900">Testing information</p>
                    <p className="whitespace-pre-wrap text-sm text-slate-600">{product.requirements}</p>
                  </div>
                )}
              </div>
            ),
          },
        ]}
      />
      <PartnershipInlineLink
        placement="product"
        lead="Recommend trading tools to other traders?"
        label="Learn about the FXBotHub Partner Programme"
        className="mt-10 border-t border-slate-200 pt-6"
      />
    </main>
  );
}
