import Image from "next/image";
import { getPublicUrl } from "@/lib/storage/public-url";
import { cn } from "@/lib/utils";

export interface ProductCoverImage {
  storageKey: string;
  altText?: string | null;
}

// A product's cover photo (`ProductImage` position 0 — every list query
// already loads it as `images[0]`, see `productListInclude`), or a neutral
// "No image" placeholder for a product that doesn't have one yet. Sizing is
// entirely the caller's — pass an aspect ratio / fixed width via `className`
// — so the same component serves the big detail-page banner and the small
// cart/dashboard/table thumbnails without each re-implementing the
// missing-cover fallback.
export function ProductCover({
  image,
  name,
  className,
  sizes = "(min-width: 1024px) 896px, 100vw",
  priority = false,
  compact = false,
}: {
  image?: ProductCoverImage | null;
  name: string;
  className?: string;
  sizes?: string;
  priority?: boolean;
  /** Thumbnail mode: drops the placeholder's text label (too big for a tiny box). */
  compact?: boolean;
}) {
  return (
    <div className={cn("relative shrink-0 overflow-hidden bg-slate-100", className)}>
      {image ? (
        <Image
          src={getPublicUrl(image.storageKey)}
          alt={image.altText ?? `${name} cover`}
          fill
          sizes={sizes}
          priority={priority}
          className="object-cover"
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center text-xs text-slate-400" aria-label="No cover image">
          {compact ? null : "No image"}
        </div>
      )}
    </div>
  );
}
