"use client";

import { useId, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown } from "lucide-react";
import { bestMatchIndex } from "@/lib/navigation-active";
import { cn } from "@/lib/utils";

interface Item {
  label: string;
  href: string;
}

/**
 * The Account / Seller / Admin side menu on phones (hidden from md up, where the original side nav is shown). The old phone
 * version was a sideways-scrolling row that clipped items (Admin has 25); this is a collapsible menu that names the current
 * section, lists every item in two touch-sized columns, and closes itself after you pick one.
 */
export function DashboardMobileNav({ title, nav }: { title: string; nav: Item[] }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const id = useId();
  const current = bestMatchIndex(pathname, nav);

  return (
    <div className="md:hidden">
      <button
        type="button"
        id={`${id}-btn`}
        aria-expanded={open}
        aria-controls={`${id}-panel`}
        onClick={() => setOpen((v) => !v)}
        className="flex min-h-12 w-full items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 text-left shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
      >
        <span className="min-w-0">
          <span className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400">{title}</span>
          <span className="block truncate text-[15px] font-semibold text-slate-900">{current >= 0 ? nav[current].label : "Menu"}</span>
        </span>
        <ChevronDown className={cn("h-5 w-5 shrink-0 text-slate-400 transition-transform duration-200 motion-reduce:transition-none", open && "rotate-180 text-violet-600")} aria-hidden="true" />
      </button>
      <nav
        id={`${id}-panel`}
        aria-label={`${title} menu`}
        hidden={!open}
        className="mt-2 max-h-[60dvh] overflow-y-auto overscroll-contain rounded-xl border border-slate-200 bg-white p-1.5 shadow-sm"
      >
        <ul className="grid grid-cols-2 gap-1">
          {nav.map((item, index) => (
            <li key={item.href}>
              <Link
                href={item.href}
                onClick={() => setOpen(false)}
                aria-current={index === current ? "page" : undefined}
                className={cn(
                  "flex min-h-11 items-center rounded-lg px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500",
                  index === current ? "bg-violet-100 font-semibold text-violet-800" : "text-slate-700 active:bg-slate-100",
                )}
              >
                {item.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}
