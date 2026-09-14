"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

export function ProductTabs({ tabs }: { tabs: { id: string; label: string; content: React.ReactNode }[] }) {
  const [active, setActive] = useState(tabs[0]?.id);

  return (
    <div className="mt-10">
      <div className="flex flex-wrap gap-1 border-b border-slate-200">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActive(tab.id)}
            className={cn(
              "border-b-2 px-3 py-2 text-sm font-medium",
              active === tab.id
                ? "border-slate-900 text-slate-900"
                : "border-transparent text-slate-500 hover:text-slate-700"
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div className="py-6">{tabs.find((t) => t.id === active)?.content}</div>
    </div>
  );
}
