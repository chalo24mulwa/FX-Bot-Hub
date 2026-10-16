// Show/hide decision for the phone quick-links bar as the page scrolls. Pure, so the rules are unit-tested.
//
// Rules: always visible at (or above) the top of the page and while the header menu is open; hidden once the visitor scrolls
// down past the bar's own height; shown again the moment they scroll up. Small movements in either direction are ignored so
// finger jitter doesn't flicker it, and the iOS rubber-band bounce past the bottom of the page is never read as "scrolling up".

export interface ScrollSample {
  /** Current window.scrollY. */
  y: number;
  /** The scrollY of the previous sample. */
  lastY: number;
  /** Whether the bar is currently shown. */
  visible: boolean;
  /** Height of the bar in px (nothing hides before the page has scrolled past it). */
  barHeight: number;
  /** Largest valid scrollY (document height minus viewport height). */
  maxY: number;
  /** Pixels of downward movement needed to hide it. */
  hideDelta?: number;
  /** Pixels of upward movement needed to show it again. */
  showDelta?: number;
}

export const HIDE_DELTA = 6;
export const SHOW_DELTA = 3;

export function nextBarVisibility({ y, lastY, visible, barHeight, maxY, hideDelta = HIDE_DELTA, showDelta = SHOW_DELTA }: ScrollSample): boolean {
  // Top of the page (including iOS pull-down overscroll, where scrollY goes negative): always visible.
  if (y <= 0) return true;
  // Rubber-band at the bottom: the page springs back from beyond its end. That is not a scroll-up.
  if (lastY > maxY + 1 || y > maxY + 1) return visible;
  const delta = y - lastY;
  if (delta >= hideDelta && y > barHeight) return false;
  if (delta <= -showDelta) return true;
  return visible;
}
