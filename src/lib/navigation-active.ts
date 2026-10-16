// Which navigation link is "current", for the phone menu's active states. Pure so it is unit-tested.
//
// The marketplace links share one path and differ only by query string (/marketplace?platform=MT4…), and the
// path alone can't say which of them is meant — so a link with a query is never marked current itself; it only
// makes its *group* current (the group header highlights while you're anywhere under /marketplace).

/** `/guides?x=1#a` -> `/guides`. */
export function hrefPath(href: string): string {
  return href.split(/[?#]/)[0] || "/";
}

function onPath(pathname: string, path: string): boolean {
  if (path === "/") return pathname === "/";
  return pathname === path || pathname.startsWith(`${path}/`);
}

/** True when `href` is exactly where the visitor is (or beneath it, e.g. /guides/some-guide for /guides). */
export function isLinkCurrent(pathname: string, href: string): boolean {
  if (/[?#]/.test(href)) return false;
  return onPath(pathname, hrefPath(href));
}

/** True when the visitor is on, or under, any of the group's links' paths (query strings ignored). */
export function isGroupCurrent(pathname: string, links: readonly { href: string }[]): boolean {
  return links.some((link) => onPath(pathname, hrefPath(link.href)));
}

/**
 * The item that best matches the current page: the one with the longest path that the page is on or beneath, so
 * `/dashboard` (Overview) is current only on `/dashboard` itself while `/dashboard/orders/abc` selects Orders.
 * Returns -1 when nothing matches.
 */
export function bestMatchIndex(pathname: string, items: readonly { href: string }[]): number {
  let best = -1;
  let bestLength = -1;
  items.forEach((item, index) => {
    const path = hrefPath(item.href);
    if (onPath(pathname, path) && path.length > bestLength) {
      best = index;
      bestLength = path.length;
    }
  });
  return best;
}
