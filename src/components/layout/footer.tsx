import Link from "next/link";
import { PRIMARY_NAV } from "@/config/navigation";

export function Footer() {
  return (
    <footer className="border-t border-slate-200 bg-slate-50">
      <div className="mx-auto grid max-w-7xl grid-cols-2 gap-8 px-4 py-10 sm:px-6 md:grid-cols-4">
        <div className="col-span-2 md:col-span-1">
          <p className="inline-flex items-center gap-1.5 text-lg font-bold tracking-tight text-slate-900">
            <span className="inline-flex items-center rounded-md bg-gradient-to-br from-blue-600 via-violet-500 to-emerald-500 px-1.5 py-0.5 text-xs font-black italic text-white shadow-sm">
              fx
            </span>
            <span className="bg-gradient-to-r from-indigo-600 via-violet-500 to-emerald-500 bg-clip-text italic text-transparent">
              Bot
            </span>
            <span className="text-amber-600">Hub</span>
          </p>
          <p className="mt-2 text-sm text-slate-500">
            A marketplace for Forex Expert Advisors, indicators, and trading tools.
          </p>
        </div>

        {PRIMARY_NAV.map((group) => (
          <div key={group.label}>
            <p className="text-sm font-semibold text-slate-900">{group.label}</p>
            <ul className="mt-2 space-y-1">
              {group.links.slice(0, 6).map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className="text-sm text-slate-500 hover:text-slate-900">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t border-slate-200 px-4 py-4 text-center text-xs text-slate-400 sm:px-6">
        © {new Date().getFullYear()} fx Bot Hub. All rights reserved.
      </div>
    </footer>
  );
}
