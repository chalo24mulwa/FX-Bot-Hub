import type { Metadata } from "next";
import Link from "next/link";
import { CtaLink } from "@/components/partnership/cta-link";
import { ctaFor } from "@/lib/partnership/cta";
import { ArrowRight, BadgeCheck, ChevronRight, Link2, Network, ShieldCheck, Wallet } from "lucide-react";
import { auth } from "@/lib/auth";
import { pageMetadata } from "@/lib/seo/site";
import { commissionAmount, formatMoney, formatRate } from "@/lib/partnership/rules";
import { getPartnershipSettings } from "@/features/partnership/core";
import { getMyPartnerProfile } from "@/features/partnership/queries";

export const dynamic = "force-dynamic";

export const metadata: Metadata = pageMetadata({
  title: "Partnership Programme",
  description:
    "Join the FXBotHub Partnership Programme: share referral links to MT4 and MT5 trading tools and earn commission on eligible, verified purchases.",
  path: "/partnership",
});

const hero = {
  backgroundImage:
    "radial-gradient(55% 60% at 10% 0%, rgba(139,92,246,0.22), transparent 70%), radial-gradient(40% 50% at 95% 0%, rgba(245,158,11,0.12), transparent 70%), linear-gradient(180deg, #080e24 0%, #0a1030 60%, #0c1236 100%)",
};

export default async function PartnershipLandingPage() {
  const [session, settings] = await Promise.all([auth(), getPartnershipSettings()]);
  const profile = session?.user ? await getMyPartnerProfile(session.user.id) : null;
  const currency = settings.currencies[0] ?? "USD";
  const exampleBasis = 10_000_00; // 10,000.00 in the programme's main currency
  const partnerRate = formatRate(settings.partnerRateBps);
  const masterRate = formatRate(settings.masterRateBps);
  const partnerExample = commissionAmount(exampleBasis, settings.partnerRateBps);
  const masterExample = commissionAmount(exampleBasis, settings.masterRateBps);

  const cta = !session?.user
    ? { href: "/auth/sign-up?callbackUrl=%2Fdashboard%2Fpartnership", label: "Create a free account to apply" }
    : ctaFor({ signedIn: true, status: profile?.status ?? null, masterStatus: profile?.masterStatus ?? null, programmeOpen: settings.programmeOpen });

  return (
    <main className="w-full min-w-0 flex-1 bg-slate-50">
      <section className="text-slate-200" style={hero}>
        <div className="mx-auto max-w-6xl px-4 pb-14 pt-6 sm:px-6 sm:pb-20">
          <nav aria-label="Breadcrumb" className="text-sm text-slate-400">
            <ol className="flex items-center gap-1.5">
              <li>
                <Link href="/" className="hover:text-white">
                  Home
                </Link>
              </li>
              <li aria-hidden="true">
                <ChevronRight className="h-3.5 w-3.5" />
              </li>
              <li aria-current="page" className="text-slate-200">
                Partnership
              </li>
            </ol>
          </nav>
          <div className="mt-10 max-w-3xl">
            <h1 className="text-4xl font-bold tracking-tight text-white sm:text-5xl">FXBotHub Partnership Programme</h1>
            <p className="mt-5 text-lg leading-relaxed text-slate-300">
              Share FXBotHub with traders you know. When someone you refer buys an eligible product, you earn {partnerRate} of what
              they paid — tracked automatically, shown transparently in your dashboard.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-4">
              {settings.programmeOpen || profile ? (
                <CtaLink
                  placement="landing"
                  href={cta.href}
                  className="inline-flex items-center gap-2 rounded-lg bg-amber-400 px-5 py-3 text-sm font-semibold text-slate-950 hover:bg-amber-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-200"
                >
                  {cta.label} <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </CtaLink>
              ) : (
                <p className="rounded-lg border border-white/15 px-4 py-3 text-sm text-slate-300">New applications are paused at the moment.</p>
              )}
              <Link href="/partnership/terms" className="text-sm font-medium text-slate-300 underline-offset-4 hover:text-white hover:underline">
                Read the programme terms
              </Link>
            </div>
            {!session?.user && (
              <p className="mt-4 text-sm text-slate-400">
                Already have an account?{" "}
                <Link href="/auth/sign-in?callbackUrl=%2Fdashboard%2Fpartnership" className="font-medium text-slate-200 underline underline-offset-4">
                  Sign in
                </Link>
                 to apply from your dashboard.
              </p>
            )}
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-6xl space-y-16 px-4 py-14 sm:px-6">
        <section aria-labelledby="how-title">
          <h2 id="how-title" className="text-2xl font-semibold tracking-tight text-slate-900">
            How it works
          </h2>
          <ol className="mt-6 grid gap-4 md:grid-cols-3">
            {[
              { icon: BadgeCheck, title: "Apply", text: "Apply from your FXBotHub account. Our team reviews every application." },
              { icon: Link2, title: "Share your links", text: "Once approved you get a personal referral link, plus links to any product in the marketplace." },
              { icon: Wallet, title: "Earn on verified sales", text: `Earn ${partnerRate} of eligible purchases. After a ${settings.holdDays}-day holding period it becomes available for payout.` },
            ].map((s, i) => (
              <li key={s.title} className="rounded-xl border border-slate-200 bg-white p-5">
                <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-violet-600 text-white">
                  <s.icon className="h-5 w-5" aria-hidden="true" />
                </span>
                <p className="mt-4 font-semibold text-slate-900">
                  {i + 1}. {s.title}
                </p>
                <p className="mt-1.5 text-sm leading-6 text-slate-600">{s.text}</p>
              </li>
            ))}
          </ol>
        </section>

        <section aria-labelledby="tracking-title" className="grid gap-8 lg:grid-cols-2">
          <div>
            <h2 id="tracking-title" className="text-2xl font-semibold tracking-tight text-slate-900">
              Referral tracking
            </h2>
            <ul className="mt-4 list-disc space-y-2 pl-5 text-slate-700 marker:text-violet-400">
              <li>A visit through your link is remembered on that device for {settings.attributionDays} days.</li>
              <li>If the visitor signs up in that time, their account is linked to you — permanently. Another Partner&apos;s link can&apos;t take it over.</li>
              <li>
                Purchases by accounts linked to you are credited to you
                {settings.referredUserCommissionDays > 0 ? ` for ${settings.referredUserCommissionDays} days after they register` : ""}. Other
                purchases count when the buyer followed your link within {settings.attributionDays} days.
              </li>
              <li>Only purchases with a verified, successful payment earn commission. Refunded orders are reversed.</li>
              <li>You can&apos;t earn commission on your own purchases.</li>
            </ul>
          </div>
          <div>
            <h2 className="text-2xl font-semibold tracking-tight text-slate-900">Commission and payouts</h2>
            <ul className="mt-4 list-disc space-y-2 pl-5 text-slate-700 marker:text-violet-400">
              <li>{partnerRate} of the price paid for each eligible product. Free products don&apos;t earn commission.</li>
              <li>New commission is pending for {settings.holdDays} days, then approved.</li>
              <li>Request a payout once your approved balance reaches {formatMoney(settings.minPayoutCents, currency)}.</li>
              <li>Payouts are reviewed and sent by the FXBotHub team; every one is recorded with a transfer reference.</li>
            </ul>
          </div>
        </section>

        <section aria-labelledby="master-title" className="rounded-2xl border border-violet-200 bg-gradient-to-br from-white to-violet-50 p-6 sm:p-8">
          <div className="flex items-start gap-4">
            <span className="hidden h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-violet-600 text-white sm:flex">
              <Network className="h-6 w-6" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <h2 id="master-title" className="text-2xl font-semibold tracking-tight text-slate-900">
                Master Partners
              </h2>
              <p className="mt-2 max-w-3xl text-slate-700">
                Approved Partners can apply to become a Master Partner. Master Partners get a recruitment link: Partners who join the
                programme through it become their recruited Partners. On eligible sales those Partners make, the Master Partner earns an
                additional {masterRate} — paid by FXBotHub, never taken from the recruited Partner&apos;s {partnerRate}.
              </p>
              <div className="mt-6 overflow-x-auto">
                <table className="w-full min-w-[480px] text-left text-sm">
                  <caption className="mb-2 text-left text-xs text-slate-500">
                    Worked example: one eligible purchase of {formatMoney(exampleBasis, currency)}
                  </caption>
                  <thead className="text-slate-500">
                    <tr className="border-b border-violet-200">
                      <th className="py-2 pr-4 font-medium">Who referred the buyer</th>
                      <th className="py-2 pr-4 font-medium">Partner earns</th>
                      <th className="py-2 font-medium">Their Master Partner earns</th>
                    </tr>
                  </thead>
                  <tbody className="text-slate-800">
                    <tr className="border-b border-violet-100">
                      <td className="py-2 pr-4">A Partner recruited by a Master Partner</td>
                      <td className="py-2 pr-4">{formatMoney(partnerExample, currency)} ({partnerRate})</td>
                      <td className="py-2">{formatMoney(masterExample, currency)} ({masterRate})</td>
                    </tr>
                    <tr className="border-b border-violet-100">
                      <td className="py-2 pr-4">A Partner who wasn&apos;t recruited</td>
                      <td className="py-2 pr-4">{formatMoney(partnerExample, currency)} ({partnerRate})</td>
                      <td className="py-2">—</td>
                    </tr>
                    <tr>
                      <td className="py-2 pr-4">The Master Partner themselves</td>
                      <td className="py-2 pr-4">{formatMoney(partnerExample, currency)} ({partnerRate})</td>
                      <td className="py-2">— (no extra on their own referrals)</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <p className="mt-4 text-sm text-slate-600">
                Recruitment is one level only, a Partner can have only one recruiting Master Partner, and nothing is earned for
                recruiting itself — only from eligible product sales.
              </p>
            </div>
          </div>
        </section>

        <section className="flex gap-3 rounded-xl border border-slate-300 bg-slate-100 p-5 text-sm leading-6 text-slate-700">
          <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-slate-500" aria-hidden="true" />
          <p>
            <strong className="text-slate-900">No guaranteed earnings.</strong> What you earn depends entirely on eligible purchases by the
            people you refer. Please don&apos;t promise anyone trading profits or results when sharing your links — trading carries a high
            risk of loss. See the{" "}
            <Link href="/partnership/terms" className="font-medium text-violet-700 underline">
              programme terms
            </Link>{" "}
            for the full rules.
          </p>
        </section>
      </div>
    </main>
  );
}
