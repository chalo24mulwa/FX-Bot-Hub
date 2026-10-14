import type { Metadata } from "next";
import Link from "next/link";
import { resolveSiteUrl } from "@/lib/site-url";
import { formatMoney, formatRate } from "@/lib/partnership/rules";
import { requireApprovedPartnerPage } from "@/features/partnership/guard";
import { getPartnershipSettings } from "@/features/partnership/core";
import { getMasterOverview, listMyRecruits } from "@/features/partnership/queries";
import { CopyLink, MasterApplyForm } from "@/components/partnership/forms";
import { EmptyState, MoneyList, StatCard, StatusPill, fmtDate } from "@/components/partnership/ui";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Master Partner", robots: { index: false, follow: false } };

export default async function MasterPartnerPage() {
  const profile = await requireApprovedPartnerPage();
  const settings = await getPartnershipSettings();
  const masterRate = formatRate(settings.masterRateBps);
  const partnerRate = formatRate(settings.partnerRateBps);
  const isMaster = profile.masterStatus === "APPROVED" || profile.masterStatus === "SUSPENDED";

  if (!isMaster) {
    return (
      <div className="max-w-3xl">
        <h1 className="text-2xl font-semibold text-slate-900">Become a Master Partner</h1>
        <p className="mt-2 text-slate-700">
          Master Partners recruit new Partners with their own recruitment link. On eligible sales made by the Partners they directly
          recruit, they earn an additional {masterRate} — paid by FXBotHub, never taken from the recruited Partner&apos;s {partnerRate}. Their
          own referrals earn the standard {partnerRate}.
        </p>
        <ul className="mt-4 list-disc space-y-1.5 pl-5 text-sm text-slate-700">
          <li>Recruitment is one level only; a Partner can only ever have one recruiting Master Partner.</li>
          <li>Nothing is earned for recruiting itself — only from eligible, verified product sales.</li>
          <li>You&apos;re expected to help recruits follow the programme terms, including never promising trading profits.</li>
        </ul>
        <div className="mt-6 rounded-xl border border-slate-200 bg-white p-5">
          {profile.status !== "APPROVED" ? (
            <p className="text-sm text-red-700">Only active Partners can apply.</p>
          ) : profile.masterStatus === "PENDING" ? (
            <p className="flex flex-wrap items-center gap-2 text-sm text-slate-700">
              <StatusPill status="PENDING" /> You applied on {fmtDate(profile.masterAppliedAt)}. We&apos;ll let you know when it&apos;s been reviewed.
            </p>
          ) : (
            <>
              {profile.masterStatus === "REJECTED" && (
                <p className="mb-4 rounded-md bg-red-50 p-3 text-sm text-red-800">
                  Your previous application wasn&apos;t approved.{profile.masterDecisionReason ? ` Reason: ${profile.masterDecisionReason}` : ""} You can apply again.
                </p>
              )}
              <MasterApplyForm />
            </>
          )}
        </div>
      </div>
    );
  }

  const [overview, recruits] = await Promise.all([getMasterOverview(profile.id), listMyRecruits(profile.id)]);
  const base = resolveSiteUrl().replace(/\/$/, "");
  const active = profile.masterStatus === "APPROVED" && profile.status === "APPROVED" && profile.masterCode;

  return (
    <div className="min-w-0 space-y-8">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold text-slate-900">Master Partner</h1>
        <StatusPill status={profile.masterStatus} />
      </div>
      {profile.masterStatus === "SUSPENDED" && (
        <p className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          Your Master Partner status is suspended{profile.masterDecisionReason ? ` (${profile.masterDecisionReason})` : ""}. You won&apos;t earn new Master Partner commission and your recruitment link is inactive.
        </p>
      )}
      {active && (
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <CopyLink url={`${base}/partnership/join?master=${profile.masterCode}`} label="Your recruitment link" shareText="Join the FXBotHub Partnership Programme" />
          <p className="mt-3 text-xs text-slate-500">
            This is for recruiting Partners, not for referring buyers — use your{" "}
            <Link href="/dashboard/partnership/links" className="text-violet-700 underline">
              referral links
            </Link>{" "}
            for that.
          </p>
        </div>
      )}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total Partners recruited" value={overview.recruited} />
        <StatCard label="Active recruited Partners" value={overview.activeRecruits} />
        <StatCard label="Applications awaiting review" value={overview.pendingApplications} />
        <StatCard label="Eligible sales by recruits" value={<MoneyList items={overview.eligibleSales} field="basisCents" />} />
        <StatCard label="Pending Master commission" value={<MoneyList items={overview.totals} field="pending" />} />
        <StatCard label="Approved Master commission" value={<MoneyList items={overview.totals} field="approved" />} />
        <StatCard label="Available for payout" value={<MoneyList items={overview.totals} field="available" />} />
        <StatCard label="Total Master commission paid" value={<MoneyList items={overview.totals} field="paid" />} />
      </div>

      <section>
        <h2 className="text-lg font-semibold text-slate-900">My recruited Partners</h2>
        {recruits.length === 0 ? (
          <div className="mt-3">
            <EmptyState title="No recruited Partners yet.">Share your recruitment link with people who&apos;d make good Partners.</EmptyState>
          </div>
        ) : (
          <div className="mt-3 overflow-x-auto rounded-xl border border-slate-200 bg-white">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="bg-slate-50 text-left text-slate-500">
                <tr>
                  <th className="px-4 py-2 font-medium">Partner</th>
                  <th className="px-4 py-2 font-medium">Applied</th>
                  <th className="px-4 py-2 font-medium">Approved</th>
                  <th className="px-4 py-2 font-medium">Status</th>
                  <th className="px-4 py-2 font-medium">Eligible sales</th>
                  <th className="px-4 py-2 font-medium">Your commission</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {recruits.map((r) => (
                  <tr key={r.key}>
                    <td className="px-4 py-2 font-medium text-slate-900">{r.label}</td>
                    <td className="whitespace-nowrap px-4 py-2 text-slate-600">{fmtDate(r.appliedAt)}</td>
                    <td className="whitespace-nowrap px-4 py-2 text-slate-600">{r.confirmed ? fmtDate(r.approvedAt) : "—"}</td>
                    <td className="px-4 py-2">
                      <StatusPill status={r.status} />
                    </td>
                    <td className="px-4 py-2 text-slate-700">{r.sales.map((s) => formatMoney(s.basisCents, s.currency)).join(", ") || "—"}</td>
                    <td className="px-4 py-2 text-slate-700">{r.sales.map((s) => formatMoney(s.amountCents, s.currency)).join(", ") || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="mt-2 text-xs text-slate-500">You see each recruit&apos;s sales totals only — never their customers or payout details.</p>
      </section>
    </div>
  );
}
