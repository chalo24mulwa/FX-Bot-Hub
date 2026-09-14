import Link from "next/link";

export interface DashboardNavItem {
  label: string;
  href: string;
}

export function DashboardShell({
  title,
  nav,
  children,
}: {
  title: string;
  nav: DashboardNavItem[];
  children: React.ReactNode;
}) {
  return (
    <main className="mx-auto flex w-full max-w-7xl flex-1 gap-8 px-6 py-10">
      <aside className="w-48 shrink-0">
        <p className="mb-3 text-sm font-semibold text-slate-900">{title}</p>
        <nav className="flex flex-col gap-1">
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-md px-3 py-2 text-sm text-slate-600 hover:bg-slate-100 hover:text-slate-900"
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </aside>
      <div className="min-w-0 flex-1">{children}</div>
    </main>
  );
}
