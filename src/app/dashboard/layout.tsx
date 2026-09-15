import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { DashboardShell } from "@/components/layout/dashboard-shell";

const DASHBOARD_NAV = [
  { label: "Overview", href: "/dashboard" },
  { label: "Orders", href: "/dashboard/orders" },
  { label: "Favorites", href: "/dashboard/favorites" },
  { label: "Signal Subscriptions", href: "/dashboard/subscriptions" },
  { label: "Alerts", href: "/dashboard/alerts" },
  { label: "Notifications", href: "/dashboard/notifications" },
];

export default async function UserDashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect("/auth/sign-in");

  return (
    <DashboardShell title="Account" nav={DASHBOARD_NAV}>
      {children}
    </DashboardShell>
  );
}
