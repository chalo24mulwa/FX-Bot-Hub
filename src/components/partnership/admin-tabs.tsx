import Link from "next/link";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/admin/partnership", label: "Partners" },
  { href: "/admin/partnership/commissions", label: "Commissions" },
  { href: "/admin/partnership/payouts", label: "Payouts" },
  { href: "/admin/partnership/settings", label: "Settings" },
];

export function PartnershipAdminTabs({ current }: { current: string }) {
  return (
    <nav aria-label="Partnership admin" className="mb-6 overflow-x-auto border-b border-slate-200">
      <ul className="flex min-w-max gap-1">
        {TABS.map((t) => (
          <li key={t.href}>
            <Link
              href={t.href}
              aria-current={current === t.href ? "page" : undefined}
              className={cn("inline-flex rounded-t-md px-3 py-2 text-sm", current === t.href ? "border-b-2 border-slate-900 font-medium text-slate-900" : "text-slate-600 hover:text-slate-900")}
            >
              {t.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
