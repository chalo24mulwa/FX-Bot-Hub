import { cn } from "@/lib/utils";

const STAR_PATH = "M12 2.5l2.94 5.96 6.58.96-4.76 4.64 1.12 6.55L12 17.5l-5.88 3.11 1.12-6.55L2.48 9.42l6.58-.96L12 2.5z";

function Stars({ className }: { className: string }) {
  return (
    <span className="flex">
      {[0, 1, 2, 3, 4].map((i) => (
        <svg key={i} viewBox="0 0 24 24" className={cn("shrink-0", className)} fill="currentColor" aria-hidden="true">
          <path d={STAR_PATH} />
        </svg>
      ))}
    </span>
  );
}

/**
 * Five stars for a product's rating. The fill is exact (4.3 fills four stars and 30% of the fifth), computed from the stored
 * average. A product with no ratings shows five EMPTY stars and "Not yet rated" — never a made-up value, never filled stars.
 * The count text is opt-out for tight spaces. Accessible as one image: "4.3 out of 5 stars, 12 reviews".
 */
export function StarRating({
  average,
  count,
  size = "sm",
  showText = true,
  className,
}: {
  average?: number | null;
  count?: number | null;
  size?: "sm" | "md" | "lg";
  showText?: boolean;
  className?: string;
}) {
  const reviews = count ?? 0;
  const rated = reviews > 0 && typeof average === "number" && Number.isFinite(average);
  const value = rated ? Math.max(0, Math.min(5, average as number)) : 0;
  const starClass = size === "lg" ? "h-6 w-6" : size === "md" ? "h-5 w-5" : "h-4 w-4";
  const label = rated ? `${value.toFixed(1)} out of 5 stars, ${reviews} review${reviews === 1 ? "" : "s"}` : "Not yet rated";

  return (
    <span className={cn("inline-flex items-center gap-1.5", className)} data-testid="star-rating" data-rated={rated ? "true" : "false"}>
      <span role="img" aria-label={label} className="relative inline-flex">
        <span className="text-slate-300">
          <Stars className={starClass} />
        </span>
        {rated && (
          <span className="absolute inset-y-0 left-0 overflow-hidden text-amber-500" style={{ width: `${(value / 5) * 100}%` }} data-testid="star-fill">
            <Stars className={starClass} />
          </span>
        )}
      </span>
      {showText &&
        (rated ? (
          <span className={cn("text-slate-600", size === "sm" ? "text-xs" : "text-sm")}>
            <span className="font-medium text-slate-800">{value.toFixed(1)}</span> ({reviews})
          </span>
        ) : (
          <span className={cn("text-slate-400", size === "sm" ? "text-xs" : "text-sm")}>Not yet rated</span>
        ))}
    </span>
  );
}
