import Link from "next/link";
import Image from "next/image";
import { Badge } from "@/components/ui/badge";
import { CardContent } from "@/components/ui/card";
import { ProductCardShell } from "./product-card-shell";
import { StarRating } from "./star-rating";
import { FavoriteButton } from "./favorite-button";
import { getPublicUrl } from "@/lib/storage";
import { cn, formatPriceCents } from "@/lib/utils";
import { priceDisplay } from "@/lib/pricing/discount";
import { DiscountBadge } from "./discount-badge";

const TYPE_LABEL: Record<string, string> = {
  EA: "Expert Advisor",
  INDICATOR: "Indicator",
  SIGNAL: "Signal",
  TOOL: "Tool",
  OTHER: "Other",
};

export interface ProductCardData {
  id: string;
  slug: string;
  name: string;
  type: string;
  platform: string;
  pricingType: string;
  priceCents: number;
  /** Original price, crossed out; only shown when it forms a valid discount with priceCents. */
  marketPriceCents?: number | null;
  currency: string;
  featured: boolean;
  updatedAt: Date | string;
  seller: { name: string | null; sellerProfile?: { verified: boolean } | null };
  images: { storageKey: string; altText: string | null }[];
  rating: { average: number; count: number } | null;
  /** Shown in the hover/tap preview; absent on callers that do not load them (the preview then just has less to show). */
  shortSummary?: string | null;
  features?: string[] | null;
}

export function ProductCard({
  product,
  isFavorited = false,
}: {
  product: ProductCardData;
  isFavorited?: boolean;
}) {
  const cover = product.images[0];
  const updated = new Date(product.updatedAt);
  const price = priceDisplay(product);
  const features = (product.features ?? []).filter(Boolean).slice(0, 2);

  return (
    <ProductCardShell
      favorite={<FavoriteButton productId={product.id} initialFavorited={isFavorited} className="absolute right-2 top-2 z-30" />}
    >

      <Link href={`/marketplace/${product.slug}`} className="flex flex-1 flex-col">
        {/*
          Fixed-ratio cover: the image layer and the details panel are stacked inside it, so collapsing the image and sliding the
          panel in changes nothing about the card's overall size (no layout jump for the grid). Hover and keyboard focus drive it in
          CSS; on touch screens the shell's details button sets data-open.
        */}
        <div className="relative aspect-[16/10] w-full overflow-hidden bg-slate-100">
          <div className="absolute inset-x-0 top-0 h-full transition-[height] duration-300 ease-out group-hover:h-[34%] group-has-[a:focus-visible]:h-[34%] group-data-[open=true]:h-[34%] motion-reduce:transition-none">
            {cover ? (
              <Image
                src={getPublicUrl(cover.storageKey)}
                alt={cover.altText ?? product.name}
                fill
                sizes="(min-width: 1024px) 320px, (min-width: 640px) 45vw, 90vw"
                className="object-cover"
              />
            ) : (
              <div className="flex h-full items-center justify-center text-xs text-slate-400">No image</div>
            )}
          </div>

          <div
            data-testid="card-preview"
            className="absolute inset-x-0 bottom-0 flex h-[66%] translate-y-full flex-col gap-1.5 overflow-hidden bg-white px-3 py-2.5 opacity-0 [@media(hover:none)]:pr-14 transition-[transform,opacity] duration-300 ease-out group-hover:translate-y-0 group-hover:opacity-100 group-has-[a:focus-visible]:translate-y-0 group-has-[a:focus-visible]:opacity-100 group-data-[open=true]:translate-y-0 group-data-[open=true]:opacity-100 motion-reduce:transition-none"
          >
            <p className="line-clamp-3 text-xs leading-snug text-slate-700">{product.shortSummary || "Open the product to see the full description."}</p>
            {features.length > 0 && (
              <ul className="flex flex-col gap-0.5 text-[11px] text-slate-600">
                {features.map((f) => (
                  <li key={f} className="flex gap-1">
                    <span aria-hidden="true" className="text-emerald-600">
                      ✓
                    </span>
                    <span className="truncate">{f}</span>
                  </li>
                ))}
              </ul>
            )}
            <span className="mt-auto text-[11px] font-medium text-violet-700">View details →</span>
          </div>

          {price.percent !== null && (
            <DiscountBadge
              percent={price.percent}
              className="origin-top-left transition-transform duration-300 group-hover:scale-[0.62] group-has-[a:focus-visible]:scale-[0.62] group-data-[open=true]:scale-[0.62] motion-reduce:transition-none"
            />
          )}
          {product.featured && (
            <Badge
              className={cn(
                "absolute border-amber-300 bg-amber-50 text-amber-800 transition-opacity duration-200 group-hover:opacity-0 group-has-[a:focus-visible]:opacity-0 group-data-[open=true]:opacity-0",
                // The discount badge owns the top-left corner; Featured moves to the bottom-left when both apply.
                price.percent !== null ? "bottom-2 left-2" : "left-2 top-2"
              )}
            >
              Featured
            </Badge>
          )}
        </div>

        <CardContent className="flex flex-1 flex-col gap-2 pt-4">
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge>{product.platform.replace("_", " ")}</Badge>
            <Badge>{TYPE_LABEL[product.type] ?? product.type}</Badge>
          </div>

          <h3 className="line-clamp-1 font-semibold text-slate-900">{product.name}</h3>

          <div className="flex items-center gap-1.5 text-sm text-slate-500">
            <span>by {product.seller.name ?? "Unknown"}</span>
            {product.seller.sellerProfile?.verified && (
              <span title="Verified seller" className="text-blue-600">
                ✓
              </span>
            )}
          </div>

          <StarRating average={product.rating?.average} count={product.rating?.count} />

          <div className="mt-auto flex items-center justify-between pt-2">
            <span
              className={cn(
                "font-semibold",
                product.pricingType === "FREE" ? "text-emerald-600" : "text-slate-900"
              )}
            >
              {product.pricingType === "FREE"
                ? "Free"
                : formatPriceCents(product.priceCents, product.currency)}
              {price.marketCents !== null && (
                <span data-testid="market-price" className="ml-1.5 text-sm font-normal text-slate-400 line-through">
                  <span className="sr-only">Original price </span>
                  {formatPriceCents(price.marketCents, product.currency)}
                </span>
              )}
              {product.pricingType === "SUBSCRIPTION" && (
                <span className="text-xs font-normal text-slate-500"> /mo</span>
              )}
            </span>
            <span className="text-xs text-slate-400">
              Updated {updated.toLocaleDateString(undefined, { month: "short", day: "numeric" })}
            </span>
          </div>
        </CardContent>
      </Link>
    </ProductCardShell>
  );
}
