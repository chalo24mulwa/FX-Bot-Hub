"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

// The Community sidebars are always visible on desktop; on small screens they
// collapse behind a titled toggle so the feed stays first. One copy of the
// content (rendered by the server and passed in as children) — CSS decides
// whether the toggle or the always-open panel is shown, not two renders.
export function MobileCollapsible({
  title,
  summary,
  defaultOpen = false,
  children,
  className,
}: {
  title: string;
  summary?: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className={className}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center justify-between rounded-xl border border-white/10 bg-[#0e1530] px-4 py-2.5 text-left text-sm font-medium text-white transition-colors hover:bg-[#131c3f] lg:hidden"
      >
        <span>
          {title}
          {summary && <span className="ml-2 text-xs font-normal text-slate-400">{summary}</span>}
        </span>
        <ChevronDown className={cn("h-4 w-4 text-slate-400 transition-transform motion-reduce:transition-none", open && "rotate-180")} aria-hidden="true" />
      </button>
      <div className={cn(open ? "mt-3 block" : "hidden", "lg:mt-0 lg:block")}>{children}</div>
    </section>
  );
}
