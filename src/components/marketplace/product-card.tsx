import Link from "next/link";
import Image from "next/image";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { FavoriteButton } from "./favorite-button";
import { getPublicUrl } from "@/lib/storage";
import { cn, formatPriceCents } from "@/lib/utils";

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
  currency: string;
  featured: boolean;
  updatedAt: Date | string;
  seller: { name: string | null; sellerProfile?: { verified: boolean } | null };
  images: { storageKey: string; altText: string | null }[];
  rating: { average: number; count: number } | null;
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

  return (
    <Card className="group relative flex h-full flex-col overflow-hidden transition-shadow hover:shadow-md">
      <FavoriteButton
        productId={product.id}
        initialFavorited={isFavorited}
        className="absolute right-2 top-2 z-10"
      />

      <Link href={`/marketplace/${product.slug}`} className="flex flex-1 flex-col">
        <div className="relative aspect-[16/10] w-full bg-slate-100">
          {cover ? (
            <Image
              src={getPublicUrl(cover.storageKey)}
              alt={cover.altText ?? product.name}
              fill
              sizes="(min-width: 1024px) 320px, (min-width: 640px) 45vw, 90vw"
              className="object-cover"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-xs text-slate-400">
              No image
            </div>
          )}
          {product.featured && (
            <Badge className="absolute left-2 top-2 border-amber-300 bg-amber-50 text-amber-800">
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

          <div className="flex items-center gap-1 text-sm text-slate-600">
            <span aria-hidden className="text-amber-500">
              ★
            </span>
            <span>{product.rating ? product.rating.average.toFixed(1) : "—"}</span>
            <span className="text-slate-400">
              ({product.rating?.count ?? 0} review{product.rating?.count === 1 ? "" : "s"})
            </span>
          </div>

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
    </Card>
  );
}
