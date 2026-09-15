import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { isSeller } from "@/lib/authorization/roles";
import { DashboardShell } from "@/components/layout/dashboard-shell";

const SELLER_NAV = [
  { label: "Overview", href: "/seller" },
  { label: "My Products", href: "/seller/products" },
  { label: "New Product", href: "/seller/products/new" },
  { label: "Orders", href: "/seller/orders" },
  { label: "Reviews", href: "/seller/reviews" },
  { label: "Customers", href: "/seller/customers" },
  { label: "Analytics", href: "/seller/analytics" },
  { label: "Profile", href: "/seller/profile" },
  { label: "Payout & Balance", href: "/seller/payout" },
];

export default async function SellerLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user || !isSeller(session.user.role)) {
    redirect("/auth/sign-in");
  }

  return (
    <DashboardShell title="Seller" nav={SELLER_NAV}>
      {children}
    </DashboardShell>
  );
}
