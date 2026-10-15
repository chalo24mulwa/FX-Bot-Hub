import { ArrowRight, Handshake } from "lucide-react";
import { formatRate } from "@/lib/partnership/rules";
import { ctaFor, isInvitation, LANDING_PATH, type CtaPlacement } from "@/lib/partnership/cta";
import { getViewerPartnerState, readPromoSettings } from "@/features/partnership/viewer";
import { CtaLink } from "./cta-link";
import { cn } from "@/lib/utils";

// "Be Our Partner" calls to action. Personalised variants read the viewer's
// real Partnership status (members get their dashboard, applicants their
// application, nobody gets asked to apply twice). The neutral `inline`/`rail`
// variants don't read the session, so they're safe on statically generated
// pages — they point at /partnership, which is itself status-aware.

const MEMBER_COPY: Record<string, string> = {
  pending: "Your Partner application is being reviewed — we'll notify you when it's decided.",
  suspended: "Your Partnership is currently suspended. See your dashboard for details.",
  partner: "Share your referral links, track referred sales and commission, and request payouts.",
  master: "Your recruitment link, recruited Partners and Master Partner commission are in one place.",
  info: "New Partner applications are paused at the moment.",
};

async function copy() {
  const s = await readPromoSettings();
  return {
    partnerRate: formatRate(s.partnerRateBps),
    masterRate: formatRate(s.masterRateBps),
    supporting: `Share FXBotHub with your audience and earn ${formatRate(s.partnerRateBps)} commission on eligible referred sales. Eligible Partners can apply to become Master Partners and earn additional commission from directly recruited Partners.`,
  };
}

/** Prominent homepage section. */
export async function PartnershipSection({ placement }: { placement: CtaPlacement }) {
  const [state, c] = await Promise.all([getViewerPartnerState(), copy()]);
  const cta = ctaFor(state);
  const inviting = isInvitation(cta);
  return (
    <section aria-labelledby="partner-cta-title" className="mx-auto max-w-6xl px-6 py-12">
      <div
        className="overflow-hidden rounded-2xl p-6 text-slate-200 sm:p-10"
        style={{
          backgroundImage:
            "radial-gradient(60% 80% at 0% 0%, rgba(139,92,246,0.25), transparent 70%), radial-gradient(45% 70% at 100% 100%, rgba(245,158,11,0.14), transparent 70%), linear-gradient(135deg, #080e24 0%, #0c1236 100%)",
        }}
      >
        <div className="grid items-center gap-8 lg:grid-cols-[minmax(0,1fr)_auto]">
          <div className="min-w-0">
            <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-amber-300">
              <Handshake className="h-4 w-4" aria-hidden="true" /> FXBotHub Partnership Programme
            </p>
            <h2 id="partner-cta-title" className="mt-3 text-2xl font-bold tracking-tight text-white sm:text-3xl">
              {inviting ? "Earn with FXBotHub" : cta.kind === "partner" || cta.kind === "master" ? "Your Partnership" : "Partnership"}
            </h2>
            <p className="mt-3 max-w-2xl leading-relaxed text-slate-300">{inviting ? c.supporting : MEMBER_COPY[cta.kind] ?? c.supporting}</p>
            {inviting && (
              <ul className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-sm text-slate-300">
                <li>
                  <strong className="text-white">{c.partnerRate}</strong> on eligible, verified purchases you refer
                </li>
                <li>
                  <strong className="text-white">+{c.masterRate}</strong> for Master Partners on their recruits&apos; sales
                </li>
                <li>No guaranteed earnings — you earn only on real, eligible sales</li>
              </ul>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <CtaLink
              href={cta.href}
              placement={placement}
              className="inline-flex items-center gap-2 rounded-lg bg-amber-400 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-amber-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-200 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0c1236]"
            >
              {cta.label} <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </CtaLink>
            {inviting && (
              <CtaLink href={LANDING_PATH} placement={placement} className="text-sm font-medium text-slate-300 underline-offset-4 hover:text-white hover:underline">
                How the programme works
              </CtaLink>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

/** Compact card for dashboards and sidebars ("Earn with FXBotHub" for non-members, quick links for members). */
export async function PartnershipCard({ placement, className }: { placement: CtaPlacement; className?: string }) {
  const [state, c] = await Promise.all([getViewerPartnerState(), copy()]);
  const cta = ctaFor(state);
  const inviting = isInvitation(cta);
  const member = cta.kind === "partner" || cta.kind === "master";
  return (
    <aside aria-label="FXBotHub Partnership" className={cn("rounded-xl border border-violet-200 bg-gradient-to-br from-white to-violet-50 p-5", className)}>
      <p className="flex items-center gap-2 font-semibold text-slate-900">
        <Handshake className="h-5 w-5 text-violet-600" aria-hidden="true" />
        {inviting ? "Earn with FXBotHub" : member ? (cta.kind === "master" ? "Master Partner" : "Your Partnership") : "Partnership"}
      </p>
      <p className="mt-2 text-sm leading-6 text-slate-600">
        {inviting
          ? `Refer buyers to quality forex trading tools and earn ${c.partnerRate} commission on eligible purchases through your unique referral links. Approved Partners can also apply to become Master Partners.`
          : MEMBER_COPY[cta.kind]}
      </p>
      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
        <CtaLink
          href={cta.href}
          placement={placement}
          className="inline-flex items-center gap-1.5 rounded-md bg-violet-600 px-3.5 py-2 font-semibold text-white hover:bg-violet-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 focus-visible:ring-offset-2"
        >
          {cta.label} <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </CtaLink>
        {member && (
          <>
            <CtaLink href="/dashboard/partnership/links" placement={placement} className="font-medium text-violet-700 hover:underline">
              Referral links
            </CtaLink>
            <CtaLink href="/dashboard/partnership/commissions" placement={placement} className="font-medium text-violet-700 hover:underline">
              Commissions
            </CtaLink>
          </>
        )}
        {(inviting || member) && (
          <CtaLink href="/partnership/terms" placement={placement} className="font-medium text-slate-600 hover:underline">
            Programme terms
          </CtaLink>
        )}
      </div>
    </aside>
  );
}

/** One quiet sentence with a descriptive link — for content pages. Session-free (safe on static pages). */
export function PartnershipInlineLink({ placement, lead, label = "Learn about the FXBotHub Partner Programme", className }: { placement: CtaPlacement; lead?: string; label?: string; className?: string }) {
  return (
    <p className={cn("text-sm text-slate-600", className)}>
      {lead ? `${lead} ` : ""}
      <CtaLink href={LANDING_PATH} placement={placement} className="font-medium text-violet-700 underline decoration-violet-300 underline-offset-2 hover:decoration-violet-600">
        {label}
      </CtaLink>
      .
    </p>
  );
}
