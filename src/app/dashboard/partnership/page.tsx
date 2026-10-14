import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { resolveSiteUrl } from "@/lib/site-url";
import { formatRate } from "@/lib/partnership/rules";
import { getPartnershipSettings } from "@/features/partnership/core";
import { getMasterOverview, getMyPartnerProfile, getPartnerOverview } from "@/features/partnership/queries";
import { CopyLink, PartnerApplyForm } from "@/components/partnership/forms";
import { MoneyList, StatCard, StatusPill, fmtDate } from "@/components/partnership/ui";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Partnership", robots: { index: false, follow: false } };

export default async function PartnershipOverviewPage() {
  const session = await auth();
  if (!session?.user) redirect("/auth/sign-in");
  const [profile, settings] = await Promise.all([getMyPartnerProfile(session.user.id), getPartnershipSettings()]);
  const rate = formatRate(settings.partnerRateBps);

  if (!profile || profile.status === "REJECTED") {
    return (
      <div className="max-w-3xl">
        <h1 className="text-2xl font-semibold text-slate-900">Partnership Programme</h1>
        {profile?.status === "REJECTED" ? (
          <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
            <p className="font-medium">Your application on {fmtDate(profile.decidedAt)} wasn&apos;t approved.</p>
            {profile.decisionReason && <p className="mt-1">Reason: {profile.decisionReason}</p>}
            <p className="mt-1">You&apos;re welcome to apply again.</p>
          </div>
        ) : (
          <p className="mt-2 text-slate-600">
            Refer traders to FXBotHub and earn {rate} of eligible, verified purchases they make. Every application is reviewed by our team.{" "}
            <Link href="/partnership" className="font-medium text-violet-700 underline">
              How it works
            </Link>
          </p>
        )}
        <div className="mt-6 rounded-xl border border-slate-200 bg-white p-5 sm:p-6">
          {settings.programmeOpen ? (
            <PartnerApplyForm reapply={profile?.status === "REJECTED"} />
          ) : (
            <p className="text-sm text-slate-600">The programme isn&apos;t accepting new applications at the moment. Please check back later.</p>
          )}
        </div>
      </div>
    );
  }

  if (profile.status === "PENDING") {
    return (
      <div className="max-w-3xl">
        <h1 className="text-2xl font-semibold text-slate-900">Partnership Programme</h1>
        <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-5">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-medium text-amber-900">Application received</p>
            <StatusPill status="PENDING" />
          </div>
          <p className="mt-2 text-sm text-amber-900">
            You applied on {fmtDate(profile.appliedAt)}. We&apos;ll notify you when it&apos;s been reviewed. Meanwhile, you can read the{" "}
            <Link href="/partnership/terms" className="font-medium underline">
              programme terms
            </Link>
            .
          </p>
          {profile.recruitedBy && (
            <p className="mt-2 text-sm text-amber-900">You applied through a Master Partner&apos;s invitation; it&apos;s confirmed when you&apos;re approved.</p>
          )}
        </div>
      </div>
    );
  }

  // APPROVED or SUSPENDED (approved before)
  const [overview, master] = await Promise.all([
    getPartnerOverview(profile.id),
    profile.masterStatus === "APPROVED" || profile.masterStatus === "SUSPENDED" ? getMasterOverview(profile.id) : null,
  ]);
  const base = resolveSiteUrl().replace(/\/$/, "");
  const suspended = profile.status === "SUSPENDED";

  return (
    <div className="min-w-0">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold text-slate-900">Partnership overview</h1>
        <StatusPill status={profile.status} />
        {profile.masterStatus === "APPROVED" && (
          <span className="inline-flex items-center rounded-full border border-violet-200 bg-violet-50 px-2.5 py-0.5 text-xs font-medium text-violet-800">
            Master Partner
          </span>
        )}
      </div>

      {suspended && (
        <div role="status" className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          <p className="font-medium">Your Partnership is suspended.</p>
          {profile.decisionReason && <p className="mt-1">Reason: {profile.decisionReason}</p>}
          <p className="mt-1">Your links don&apos;t earn new commission and payouts are paused while it&apos;s suspended. Your history is still shown below.</p>
        </div>
      )}

      {!suspended && profile.referralCode && (
        <div className="mt-6 rounded-xl border border-slate-200 bg-white p-5">
          <CopyLink url={`${base}/?ref=${profile.referralCode}`} label="Your referral link" />
          <p className="mt-3 text-xs text-slate-500">
            Your code: <span className="font-mono font-medium text-slate-700">{profile.referralCode}</span> · Add{" "}
            <span className="font-mono">?ref={profile.referralCode}</span> to any FXBotHub page, or{" "}
            <Link href="/dashboard/partnership/links" className="text-violet-700 underline">
              create product links
            </Link>
            .
          </p>
        </div>
      )}

      <h2 className="mt-8 text-sm font-semibold uppercase tracking-wider text-slate-500">Your results</h2>
      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total referral visits" value={overview.clicks} hint="Unique visitors per day" />
        <StatCard label="Registered referred users" value={overview.registered} />
        <StatCard label="Referred users who purchased" value={overview.purchasers} />
        <StatCard label="Total eligible sales" value={<MoneyList items={overview.eligibleSales} field="basisCents" />} />
        <StatCard label="Pending commission" value={<MoneyList items={overview.totals} field="pending" />} hint={`Held for ${settings.holdDays} days`} />
        <StatCard label="Approved commission" value={<MoneyList items={overview.totals} field="approved" />} />
        <StatCard label="Available for payout" value={<MoneyList items={overview.totals} field="available" />} />
        <StatCard label="Total commission paid" value={<MoneyList items={overview.totals} field="paid" />} />
      </div>
      <p className="mt-2 text-xs text-slate-500">
        Commission totals include Master Partner commission where applicable. Figures update as purchases are verified, refunded or paid out.
      </p>

      {master && (
        <>
          <h2 className="mt-8 text-sm font-semibold uppercase tracking-wider text-slate-500">Master Partner</h2>
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Partners recruited" value={master.recruited} />
            <StatCard label="Active recruited Partners" value={master.activeRecruits} />
            <StatCard label="Applications via your link" value={master.pendingApplications} hint="Awaiting review" />
            <StatCard label="Sales by recruited Partners" value={<MoneyList items={master.eligibleSales} field="basisCents" />} />
            <StatCard label="Pending Master commission" value={<MoneyList items={master.totals} field="pending" />} />
            <StatCard label="Approved Master commission" value={<MoneyList items={master.totals} field="approved" />} />
            <StatCard label="Master commission available" value={<MoneyList items={master.totals} field="available" />} />
            <StatCard label="Master commission paid" value={<MoneyList items={master.totals} field="paid" />} />
          </div>
        </>
      )}

      {overview.registered === 0 && overview.clicks === 0 && !suspended && (
        <div className="mt-8 rounded-xl border border-dashed border-slate-300 bg-white p-6 text-sm text-slate-600">
          <p className="font-medium text-slate-900">Getting started</p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>Share your referral link where traders already ask you for recommendations.</li>
            <li>Link straight to products you&apos;ve used from <Link href="/dashboard/partnership/links" className="text-violet-700 underline">Referral links</Link>.</li>
            <li>Be honest: never promise profits or guaranteed results.</li>
          </ul>
        </div>
      )}
    </div>
  );
}
