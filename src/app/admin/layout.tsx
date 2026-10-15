import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { isStaff } from "@/lib/authorization/roles";
import { can } from "@/lib/authorization/permissions";
import { requiredActionForAdminPath } from "@/lib/admin/route-permissions";
import { DashboardShell } from "@/components/layout/dashboard-shell";

const ADMIN_NAV = [
  { label: "Dashboard", href: "/admin" },
  { label: "Users", href: "/admin/users" },
  { label: "Access Sessions", href: "/admin/access-sessions" },
  { label: "Admin Roles", href: "/admin/admin-roles" },
  { label: "Products", href: "/admin/products" },
  { label: "Reviews", href: "/admin/reviews" },
  { label: "Categories", href: "/admin/categories" },
  { label: "Calendar", href: "/admin/calendar" },
  { label: "News", href: "/admin/news" },
  { label: "News Categories", href: "/admin/news-categories" },
  { label: "Best Brokers", href: "/admin/brokers" },
  { label: "Signal Providers", href: "/admin/signal-providers" },
  { label: "Signals", href: "/admin/signals" },
  { label: "Community", href: "/admin/community" },
  { label: "Data Sources", href: "/admin/data-sources" },
  { label: "Finance", href: "/admin/finance" },
  { label: "Refunds", href: "/admin/refunds" },
  { label: "Payouts", href: "/admin/payouts" },
  { label: "Partnership", href: "/admin/partnership" },
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

  // An account provisioned with a temporary password (the first administrator) can't use
  // the admin area until that password has been changed.
  const me = await db.user.findUnique({ where: { id: session.user.id }, select: { mustChangePassword: true } });
  if (me?.mustChangePassword) redirect("/dashboard/security?change=required");

  // Only show the areas this person's role can actually open (the proxy and each action enforce it too).
  const nav = ADMIN_NAV.filter((item) => {
    const needed = requiredActionForAdminPath(item.href);
    return !needed || can(session.user, needed);
  });

  return (
    <DashboardShell title="Admin" nav={nav}>
      {children}
    </DashboardShell>
  );
}
