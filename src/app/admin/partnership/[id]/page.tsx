import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePartnershipAdminPage } from "@/features/partnership/guard";
import { getPartnerForAdmin } from "@/features/partnership/queries";
import { PartnershipAdminTabs } from "@/components/partnership/admin-tabs";
import { MasterDecisionControls, PartnerDecisionControls } from "@/components/partnership/admin-controls";
import { MoneyList, StatCard, StatusPill, TIER_LABEL, fmtDate } from "@/components/partnership/ui";
import { formatMoney, formatRate } from "@/lib/partnership/rules";

export const dynamic = "force-dynamic";

export default async function AdminPartnerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePartnershipAdminPage();
  const data = await getPartnerForAdmin((await params).id);
  if (!data) notFound();
  const { profile, totals, recentCommissions, payouts, audit, security, clicksLast24h } = data;

  return (
    <div className="min-w-0 space-y-8">
      <div>
        <PartnershipAdminTabs current="/admin/partnership" />
        <Link href="/admin/partnership" className="text-sm text-violet-700 hover:underline">
          ← All Partners
        </Link>
        <h1 className="mt-2 text-2xl font-semibold text-slate-900">{profile.user.name ?? profile.user.email}</h1>
        <p className="text-sm text-slate-500">
          {profile.user.email} · account since {fmtDate(profile.user.createdAt)}
          {profile.user.bannedAt && <span className="ml-2 font-medium text-red-700">Account banned</span>}
        </p>
      </div>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-semibold text-slate-900">Partner</h2>
            <StatusPill status={profile.status} />
          </div>
          <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
            <dt className="text-slate-500">Applied</dt>
            <dd>{fmtDate(profile.appliedAt)}</dd>
            <dt className="text-slate-500">Decided</dt>
            <dd>{fmtDate(profile.decidedAt)}</dd>
            <dt className="text-slate-500">Referral code</dt>
            <dd className="font-mono">{profile.referralCode ?? "—"}</dd>
            <dt className="text-slate-500">Recruited by</dt>
            <dd>
              {profile.recruitedBy ? (
                <Link href={`/admin/partnership/${profile.recruitedBy.id}`} className="text-violet-700 hover:underline">
                  {profile.recruitedBy.user.name ?? profile.recruitedBy.user.email}
                </Link>
              ) : (
                "—"
              )}
              {profile.recruitedBy && !profile.recruitedAt && <span className="ml-1 text-xs text-slate-500">(confirmed on approval)</span>}
            </dd>
            {profile.decisionReason && (
              <>
                <dt className="text-slate-500">Last reason</dt>
                <dd>{profile.decisionReason}</dd>
              </>
            )}
          </dl>
          {profile.applicationNote && <p className="mt-3 rounded-md bg-slate-50 p-3 text-sm text-slate-700">“{profile.applicationNote}”</p>}
          <div className="mt-4">
            <PartnerDecisionControls profileId={profile.id} status={profile.status} />
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-semibold text-slate-900">Master Partner</h2>
            <StatusPill status={profile.masterStatus} />
          </div>
          <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
            <dt className="text-slate-500">Applied</dt>
            <dd>{fmtDate(profile.masterAppliedAt)}</dd>
            <dt className="text-slate-500">Decided</dt>
            <dd>{fmtDate(profile.masterDecidedAt)}</dd>
            <dt className="text-slate-500">Recruitment code</dt>
            <dd className="font-mono">{profile.masterCode ?? "—"}</dd>
            {profile.masterDecisionReason && (
              <>
                <dt className="text-slate-500">Last reason</dt>
                <dd>{profile.masterDecisionReason}</dd>
              </>
            )}
          </dl>
          {profile.masterApplicationNote && <p className="mt-3 rounded-md bg-slate-50 p-3 text-sm text-slate-700">“{profile.masterApplicationNote}”</p>}
          <div className="mt-4">
            <MasterDecisionControls profileId={profile.id} masterStatus={profile.masterStatus} partnerStatus={profile.status} />
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Referral visits (all / last 24h)" value={`${profile._count.clicks} / ${clicksLast24h}`} />
        <StatCard label="Referred accounts" value={profile._count.referredUsers} />
        <StatCard label="Credited orders" value={profile._count.orderReferrals} />
        <StatCard label="Direct recruits" value={profile.recruits.length} />
        <StatCard label="Pending" value={<MoneyList items={totals} field="pending" />} />
        <StatCard label="Available" value={<MoneyList items={totals} field="available" />} />
        <StatCard label="Paid" value={<MoneyList items={totals} field="paid" />} />
        <StatCard label="Reversed" value={<MoneyList items={totals} field="reversed" />} />
      </section>

      <section>
        <h2 className="text-lg font-semibold text-slate-900">Recent commissions</h2>
        <div className="mt-3 overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="bg-slate-50 text-left text-slate-500">
              <tr>
                <th className="px-4 py-2 font-medium">Date</th>
                <th className="px-4 py-2 font-medium">Product</th>
                <th className="px-4 py-2 font-medium">Type</th>
                <th className="px-4 py-2 font-medium">Calculation</th>
                <th className="px-4 py-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {recentCommissions.map((c) => (
                <tr key={c.id}>
                  <td className="whitespace-nowrap px-4 py-2 text-slate-600">{fmtDate(c.createdAt)}</td>
                  <td className="px-4 py-2">{c.orderItem.product.name}</td>
                  <td className="px-4 py-2">{TIER_LABEL[c.type]}</td>
                  <td className="whitespace-nowrap px-4 py-2">
                    {formatMoney(c.basisCents, c.currency)} × {formatRate(c.rateBps)} = <strong>{formatMoney(c.amountCents, c.currency)}</strong>
                  </td>
                  <td className="px-4 py-2">
                    <StatusPill status={c.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {recentCommissions.length === 0 && <p className="py-6 text-center text-sm text-slate-500">No commissions yet.</p>}
        </div>
        <Link href={`/admin/partnership/commissions?q=${profile.referralCode ?? ""}`} className="mt-2 inline-block text-sm text-violet-700 hover:underline">
          All commissions for this Partner
        </Link>
      </section>

      {profile.recruits.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold text-slate-900">Direct recruits</h2>
          <ul className="mt-3 divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white text-sm">
            {profile.recruits.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2">
                <Link href={`/admin/partnership/${r.id}`} className="text-violet-700 hover:underline">
                  {r.user.name ?? r.user.email}
                </Link>
                <span className="flex items-center gap-2 text-xs text-slate-500">
                  {r.recruitedAt ? `confirmed ${fmtDate(r.recruitedAt)}` : "unconfirmed"} <StatusPill status={r.status} />
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="grid gap-6 lg:grid-cols-2">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Payouts</h2>
          <ul className="mt-3 divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white text-sm">
            {payouts.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2">
                <span>
                  {formatMoney(p.amountCents, p.currency)} · {fmtDate(p.requestedAt)}
                </span>
                <StatusPill status={p.status} />
              </li>
            ))}
            {payouts.length === 0 && <li className="px-4 py-4 text-slate-500">No payouts.</li>}
          </ul>
        </div>
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Security signals</h2>
          <p className="text-xs text-slate-500">Signals only — nothing here acts automatically.</p>
          <ul className="mt-3 divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white text-sm">
            {security.map((e) => (
              <li key={e.id} className="px-4 py-2">
                <span className="font-medium">{e.type}</span> · {fmtDate(e.createdAt)}
                <span className="block text-xs text-slate-500">{JSON.stringify(e.metadata)}</span>
              </li>
            ))}
            {security.length === 0 && <li className="px-4 py-4 text-slate-500">None recorded.</li>}
          </ul>
        </div>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-slate-900">Decision history</h2>
        <ul className="mt-3 divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white text-sm">
          {audit.map((a) => (
            <li key={a.id} className="px-4 py-2">
              <span className="font-mono text-xs">{a.action}</span> · {a.actor?.name ?? a.actor?.email ?? "system"} · {a.createdAt.toISOString().slice(0, 16).replace("T", " ")} UTC
              {(a.metadata as { reason?: string } | null)?.reason && <span className="block text-xs text-slate-500">Reason: {(a.metadata as { reason: string }).reason}</span>}
            </li>
          ))}
          {audit.length === 0 && <li className="px-4 py-4 text-slate-500">No decisions yet.</li>}
        </ul>
      </section>
    </div>
  );
}
