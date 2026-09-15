import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { isStaff } from "@/lib/authorization/roles";
import { DashboardShell } from "@/components/layout/dashboard-shell";

const ADMIN_NAV = [
  { label: "Dashboard", href: "/admin" },
  { label: "Users", href: "/admin/users" },
  { label: "Products", href: "/admin/products" },
  { label: "Reviews", href: "/admin/reviews" },
  { label: "Categories", href: "/admin/categories" },
  { label: "Calendar", href: "/admin/calendar" },
  { label: "News", href: "/admin/news" },
  { label: "News Categories", href: "/admin/news-categories" },
  { label: "Signal Providers", href: "/admin/signal-providers" },
  { label: "Signals", href: "/admin/signals" },
  { label: "Data Sources", href: "/admin/data-sources" },
  { label: "Finance", href: "/admin/finance" },
  { label: "Refunds", href: "/admin/refunds" },
  { label: "Payouts", href: "/admin/payouts" },
  { label: "Licenses", href: "/admin/licenses" },
  { label: "Security", href: "/admin/security" },
  { label: "Background Jobs", href: "/admin/queues" },
  { label: "Analytics", href: "/admin/analytics" },
  { label: "Settings", href: "/admin/settings" },
  { label: "Audit Logs", href: "/admin/audit-logs" },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user || !isStaff(session.user.role)) {
    redirect("/auth/sign-in");
  }

  return (
    <DashboardShell title="Admin" nav={ADMIN_NAV}>
      {children}
    </DashboardShell>
  );
}
