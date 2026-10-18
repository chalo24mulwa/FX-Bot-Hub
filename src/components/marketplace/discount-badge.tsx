/**
 * The "35% OFF" mark that sits in the top-left corner of a discounted product's cover photo: big red numerals with a white
 * outline, a smaller "%" and "OFF" stacked beside them, tilted slightly — drawn as text (not an image) so it is crisp at any
 * size and the percentage is always the live, server-validated one. The parent must be `relative`; the badge never takes pointer
 * events, so the card link underneath keeps working.
 */
export function DiscountBadge({ percent, size = "md" }: { percent: number; size?: "md" | "lg" }) {
  const big = size === "lg";
  const outline = big ? "4px" : "3px";
  const style: React.CSSProperties = {
    color: "#e5121f",
    WebkitTextStroke: `${outline} #ffffff`,
    paintOrder: "stroke fill",
    textShadow: "0 2px 0 #8c0a12, 0 4px 8px rgba(0,0,0,0.45)",
  };
  return (
    <span
      data-testid="discount-badge"
      role="img"
      aria-label={`${percent}% off`}
      className={`pointer-events-none absolute left-1.5 top-1.5 z-10 inline-flex -rotate-6 select-none items-start font-black leading-none ${big ? "sm:left-3 sm:top-3" : ""}`}
      style={style}
    >
      <span aria-hidden="true" className={big ? "text-5xl sm:text-6xl" : "text-5xl"}>
        {percent}
      </span>
      <span aria-hidden="true" className="ml-0.5 flex flex-col leading-none">
        <span className={big ? "text-3xl sm:text-4xl" : "text-3xl"}>%</span>
        <span className={`-mt-0.5 ${big ? "text-xl sm:text-2xl" : "text-lg"}`}>OFF</span>
      </span>
    </span>
  );
}
