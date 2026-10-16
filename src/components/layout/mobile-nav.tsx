"use client";

import { Fragment, useId, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown, Handshake, LogIn, Newspaper, ShoppingCart, UserPlus, UserRound, type LucideIcon } from "lucide-react";
import { COMMUNITY_HREF, MENU_BAR_LINKS, PRIMARY_NAV } from "@/config/navigation";
import { isGroupCurrent, isLinkCurrent } from "@/lib/navigation-active";
import { Input } from "@/components/ui/input";
import { CtaLink } from "@/components/partnership/cta-link";
import { cn } from "@/lib/utils";

// Smartphone-only navigation (everything here is hidden from `md`/768px up, so tablets and desktops render
// exactly what they always did). It reads the same PRIMARY_NAV / MENU_BAR_LINKS config as the desktop bar —
// no routes are defined here.

interface UtilityItem {
  key: string;
  href: string;
  label: string;
  /** Accessible name when it should say more than the short visible label. */
  name?: string;
  Icon: LucideIcon;
  /** Paths (prefixes) on which this item reads as the current page. */
  match: string[];
  partner?: boolean;
  accent?: boolean;
}

const onAny = (pathname: string, prefixes: string[]) => prefixes.some((p) => pathname === p || pathname.startsWith(`${p}/`));

/**
 * The slim bar above the header: News, Partner, Cart and Sign in / Sign up (Account once signed in). A fixed grid, so
 * five labelled targets always fit, down to a 320px-wide screen, without scrolling or overlapping.
 */
export function MobileUtilityBar({ authenticated }: { authenticated: boolean }) {
  const pathname = usePathname();
  const items: UtilityItem[] = [
    { key: "news", href: "/calendar", label: "News", name: "News Calendar", Icon: Newspaper, match: ["/calendar"] },
    {
      key: "partner",
      href: authenticated ? "/dashboard/partnership" : "/partnership",
      label: "Partner",
      name: authenticated ? "Partnership" : "Be Our Partner",
      Icon: Handshake,
      match: ["/partnership", "/dashboard/partnership"],
      partner: true,
    },
    { key: "cart", href: "/cart", label: "Cart", Icon: ShoppingCart, match: ["/cart"] },
    ...(authenticated
      ? [{ key: "account", href: "/dashboard", label: "Account", Icon: UserRound, match: ["/dashboard"] } satisfies UtilityItem]
      : [
          { key: "signin", href: "/auth/sign-in", label: "Sign In", name: "Sign in", Icon: LogIn, match: ["/auth/sign-in"] } satisfies UtilityItem,
          { key: "signup", href: "/auth/sign-up", label: "Sign Up", name: "Sign up", Icon: UserPlus, match: ["/auth/sign-up"], accent: true } satisfies UtilityItem,
        ]),
  ];

  return (
    <nav aria-label="Quick links" data-utility-bar className="border-b border-white/10 bg-[#0a1030] md:hidden">
      <ul className={cn("mx-auto grid max-w-md", items.length === 4 ? "grid-cols-4" : "grid-cols-5")}>
        {items.map((item) => {
          const current = onAny(pathname, item.match);
          const className = cn(
            "flex min-h-12 flex-col items-center justify-center gap-1 px-1 py-1.5 text-[11px] font-medium leading-none transition-colors",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-violet-300 motion-reduce:transition-none",
            current ? "bg-white/10 text-white" : item.accent ? "text-amber-200 hover:bg-white/5 hover:text-amber-100" : "text-slate-300 hover:bg-white/5 hover:text-white",
          );
          const content = (
            <>
              <item.Icon className="h-[18px] w-[18px]" aria-hidden="true" />
              <span>{item.label}</span>
            </>
          );
          return (
            <li key={item.key} className="min-w-0">
              {item.partner ? (
                <CtaLink href={item.href} placement="header-mobile" className={className} aria-label={item.name} aria-current={current ? "page" : undefined}>
                  {content}
                </CtaLink>
              ) : (
                <Link href={item.href} className={className} aria-label={item.name} aria-current={current ? "page" : undefined}>
                  {content}
                </Link>
              )}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

const rowBase =
  "flex min-h-12 w-full items-center justify-between rounded-xl px-3.5 text-left text-[15px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 motion-reduce:transition-none";

interface MobileMenuPanelProps {
  onSearch: (e: React.FormEvent<HTMLFormElement>) => void;
  /** Called after any link is followed, so the panel closes instead of staying open over the new page. */
  onNavigate: () => void;
}

/**
 * The phone menu: Marketplace, Insights and Resources are expandable sections (one open at a time, chevron
 * rotates, tap again to collapse); the stand-alone links sit between them in the same order as the desktop bar.
 */
export function MobileMenuPanel({ onSearch, onNavigate }: MobileMenuPanelProps) {
  const pathname = usePathname();
  const baseId = useId();
  const [openGroup, setOpenGroup] = useState<string | null>(null);

  return (
    <nav aria-label="Mobile menu" className="max-h-[calc(100dvh-9rem)] overflow-y-auto overscroll-contain pb-1">
      <form onSubmit={onSearch} className="mb-3" role="search">
        <Input name="q" type="search" placeholder="Search products…" aria-label="Search marketplace" className="h-11 text-base" />
      </form>

      <ul className="space-y-1.5">
        {PRIMARY_NAV.map((group, index) => {
          const open = openGroup === group.label;
          const current = isGroupCurrent(pathname, group.links);
          const buttonId = `${baseId}-btn-${index}`;
          const panelId = `${baseId}-panel-${index}`;
          return (
            <Fragment key={group.label}>
              <li className={cn("rounded-xl border transition-colors motion-reduce:transition-none", open ? "border-slate-200 bg-slate-50" : "border-transparent")}>
                <button
                  type="button"
                  id={buttonId}
                  aria-expanded={open}
                  aria-controls={panelId}
                  onClick={() => setOpenGroup(open ? null : group.label)}
                  className={cn(rowBase, current ? "text-violet-700" : "text-slate-900", !open && "hover:bg-slate-50")}
                >
                  <span className="flex items-center gap-2">
                    {group.label}
                    {current && <span className="h-1.5 w-1.5 rounded-full bg-violet-500" aria-hidden="true" />}
                  </span>
                  <ChevronDown className={cn("h-5 w-5 text-slate-400 transition-transform duration-200 motion-reduce:transition-none", open && "rotate-180 text-violet-600")} aria-hidden="true" />
                </button>
                {/* Collapsed content is visibility:hidden (out of the tab order and the accessibility tree) after its
                    closing animation; the grid-rows trick animates height without measuring it. */}
                <div
                  id={panelId}
                  role="region"
                  aria-labelledby={buttonId}
                  className={cn(
                    "grid motion-reduce:transition-none",
                    open
                      ? "grid-rows-[1fr] visible [transition:grid-template-rows_200ms_ease,visibility_0s]"
                      : "invisible grid-rows-[0fr] [transition:grid-template-rows_200ms_ease,visibility_0s_linear_200ms]",
                  )}
                >
                  <div className="overflow-hidden">
                    <ul className="px-1.5 pb-2 pt-0.5">
                      {group.links.map((link) => {
                        const active = isLinkCurrent(pathname, link.href);
                        return (
                          <li key={link.href}>
                            <Link
                              href={link.href}
                              onClick={onNavigate}
                              aria-current={active ? "page" : undefined}
                              className={cn(
                                "flex min-h-11 items-center rounded-lg px-3 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 motion-reduce:transition-none",
                                active ? "bg-violet-100 font-semibold text-violet-800" : "text-slate-700 active:bg-slate-100",
                              )}
                            >
                              {link.label}
                            </Link>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                </div>
              </li>
              {MENU_BAR_LINKS.filter((link) => link.after === group.label).map((link) => (
                <StandaloneRow key={link.href} href={link.href} label={link.label} pathname={pathname} onNavigate={onNavigate} />
              ))}
            </Fragment>
          );
        })}
        <StandaloneRow href={COMMUNITY_HREF} label="Community" pathname={pathname} onNavigate={onNavigate} />
      </ul>
    </nav>
  );
}

function StandaloneRow({ href, label, pathname, onNavigate }: { href: string; label: string; pathname: string; onNavigate: () => void }) {
  const active = isLinkCurrent(pathname, href);
  return (
    <li>
      <Link
        href={href}
        onClick={onNavigate}
        aria-current={active ? "page" : undefined}
        className={cn(rowBase, active ? "bg-violet-100 text-violet-800" : "text-slate-900 hover:bg-slate-50 active:bg-slate-100")}
      >
        {label}
      </Link>
    </li>
  );
}
