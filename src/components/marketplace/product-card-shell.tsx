"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

/**
 * The card's outer frame. Desktop hover/keyboard focus is pure CSS (the `group` classes in ProductCard); this adds the touch-screen
 * alternative: where there is no hover, a "details" button (shown only by the `.card-details-toggle` rule in globals.css, i.e.
 * `@media (hover: none)`) flips `data-open`, which drives the same collapse-and-reveal as hover does. The button is a sibling of the
 * card link — never nested inside an <a> — exactly like the favourite button, and the card link keeps navigating when tapped elsewhere.
 */
export function ProductCardShell({ children, favorite, className }: { children: React.ReactNode; favorite: React.ReactNode; className?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div
      data-open={open ? "true" : "false"}
      data-testid="product-card"
      className={cn("group relative flex h-full flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm transition-shadow hover:shadow-md", className)}
    >
      {favorite}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label={open ? "Hide product details" : "Show product details"}
        className="card-details-toggle absolute right-2 top-14 z-20 h-11 w-11 items-center justify-center rounded-full bg-white/95 text-slate-700 shadow ring-1 ring-slate-200"
      >
        <span aria-hidden="true" className="text-lg font-semibold leading-none">
          {open ? "×" : "i"}
        </span>
      </button>
      {children}
    </div>
  );
}
