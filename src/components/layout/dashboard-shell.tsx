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
    // Below md the side nav becomes a horizontally scrolling row above the
    // content, so pages get the full width on phones.
    <main className="mx-auto flex w-full min-w-0 max-w-7xl flex-1 flex-col gap-6 px-4 py-8 sm:px-6 md:flex-row md:gap-8 md:py-10">
      <aside className="min-w-0 md:w-48 md:shrink-0">
        <p className="mb-3 text-sm font-semibold text-slate-900">{title}</p>
        <nav className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1 md:mx-0 md:flex-col md:overflow-visible md:px-0 md:pb-0">
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="shrink-0 whitespace-nowrap rounded-md px-3 py-2 text-sm text-slate-600 hover:bg-slate-100 hover:text-slate-900"
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
