import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getMyPartnerProfile } from "@/features/partnership/queries";

const TABS = [
  { href: "/dashboard/partnership", label: "Overview" },
  { href: "/dashboard/partnership/links", label: "Referral links" },
  { href: "/dashboard/partnership/referrals", label: "Referred users" },
  { href: "/dashboard/partnership/sales", label: "Sales" },
  { href: "/dashboard/partnership/commissions", label: "Commissions" },
  { href: "/dashboard/partnership/payouts", label: "Payouts" },
  { href: "/dashboard/partnership/master", label: "Master Partner" },
];

// Sub-navigation for the Partnership area. The tabs beyond Overview only
// appear once the member has been approved; each page also re-checks.
export default async function PartnershipDashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect("/auth/sign-in");
  const profile = await getMyPartnerProfile(session.user.id);
  const approvedOnce = Boolean(profile?.referralCode);

  return (
    <div className="min-w-0">
      {approvedOnce && (
        <nav aria-label="Partnership" className="-mx-1 mb-6 overflow-x-auto border-b border-slate-200">
          <ul className="flex min-w-max gap-1 px-1">
            {TABS.map((t) => (
              <li key={t.href}>
                <Link href={t.href} className="inline-flex rounded-t-md px-3 py-2 text-sm text-slate-600 hover:bg-slate-100 hover:text-slate-900">
                  {t.label}
                </Link>
              </li>
            ))}
            <li>
              <Link href="/partnership/terms" className="inline-flex rounded-t-md px-3 py-2 text-sm text-slate-600 hover:bg-slate-100 hover:text-slate-900">
                Programme terms
              </Link>
            </li>
          </ul>
        </nav>
      )}
      {children}
    </div>
  );
}
