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
