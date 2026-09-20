"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/admin/community", label: "Overview", exact: true },
  { href: "/admin/community/posts", label: "Posts" },
  { href: "/admin/community/reports", label: "Reports" },
  { href: "/admin/community/members", label: "Members" },
  { href: "/admin/community/categories", label: "Categories" },
  { href: "/admin/community/history", label: "History" },
];

export function CommunityAdminTabs({ openReports }: { openReports: number }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Community moderation" className="mb-6 flex flex-wrap gap-1 border-b border-slate-200">
      {TABS.map((t) => {
        const active = t.exact ? pathname === t.href : pathname.startsWith(t.href);
        return (
          <Link
            key={t.href}
            href={t.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "-mb-px inline-flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm font-medium transition-colors",
              active ? "border-violet-600 text-violet-700" : "border-transparent text-slate-500 hover:text-slate-800"
            )}
          >
            {t.label}
            {t.label === "Reports" && openReports > 0 && <span className="rounded-full bg-red-600 px-1.5 py-px text-[10px] font-bold text-white">{openReports}</span>}
          </Link>
        );
      })}
    </nav>
  );
}
