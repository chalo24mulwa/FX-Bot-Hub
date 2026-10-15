import type { Metadata } from "next";
import Link from "next/link";
import { Network } from "lucide-react";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { normalizeCode } from "@/lib/partnership/codes";
import { getPartnershipSettings } from "@/features/partnership/core";
import { getMyPartnerProfile } from "@/features/partnership/queries";
import { formatRate, referredMemberLabel } from "@/lib/partnership/rules";

export const dynamic = "force-dynamic";

// Recruitment links carry a code, so this view is never indexed; the
// programme itself is described at /partnership.
export const metadata: Metadata = {
  title: "Join the FXBotHub Partnership Programme",
  description: "You've been invited to join the FXBotHub Partnership Programme.",
  alternates: { canonical: "/partnership" },
  robots: { index: false, follow: true },
};

interface JoinPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function PartnershipJoinPage({ searchParams }: JoinPageProps) {
  const raw = (await searchParams).master;
  const code = normalizeCode(Array.isArray(raw) ? raw[0] : raw);
  const [session, settings] = await Promise.all([auth(), getPartnershipSettings()]);
  const master = code
    ? await db.partnerProfile.findUnique({
        where: { masterCode: code },
        select: { userId: true, status: true, masterStatus: true, user: { select: { profile: { select: { displayName: true } } } } },
      })
    : null;
  const valid = master && master.status === "APPROVED" && master.masterStatus === "APPROVED";
  const profile = session?.user ? await getMyPartnerProfile(session.user.id) : null;

  return (
    <main className="mx-auto w-full min-w-0 max-w-2xl flex-1 px-4 py-14 sm:px-6">
      <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-violet-600 text-white">
        <Network className="h-6 w-6" aria-hidden="true" />
      </span>
      <h1 className="mt-6 text-3xl font-bold tracking-tight text-slate-900">Join the FXBotHub Partnership Programme</h1>
      {valid ? (
        <p className="mt-4 text-lg text-slate-700">
          <strong>{referredMemberLabel(master.user.profile?.displayName, master.userId)}</strong>, an FXBotHub Master Partner, invited you to
          become a Partner. Approved Partners earn {formatRate(settings.partnerRateBps)} of eligible purchases made through their
          referral links.
        </p>
      ) : (
        <p className="mt-4 text-lg text-slate-700">
          This invitation link isn&apos;t active any more, but you can still apply to become a Partner.
        </p>
      )}
      <div className="mt-8 flex flex-wrap gap-3">
        {!session?.user ? (
          <>
            <Link href="/auth/sign-up?callbackUrl=%2Fdashboard%2Fpartnership" className="inline-flex h-11 items-center rounded-lg bg-violet-600 px-5 text-sm font-semibold text-white hover:bg-violet-500">
              Create an account
            </Link>
            <Link href="/auth/sign-in?callbackUrl=%2Fdashboard%2Fpartnership" className="inline-flex h-11 items-center rounded-lg border border-slate-300 px-5 text-sm font-semibold text-slate-800 hover:bg-slate-50">
              Sign in
            </Link>
          </>
        ) : (
          <Link href="/dashboard/partnership" className="inline-flex h-11 items-center rounded-lg bg-violet-600 px-5 text-sm font-semibold text-white hover:bg-violet-500">
            {profile ? "Open your Partnership dashboard" : "Apply to become a Partner"}
          </Link>
        )}
        <Link href="/partnership" className="inline-flex h-11 items-center rounded-lg px-3 text-sm font-medium text-violet-700 hover:underline">
          How the programme works
        </Link>
      </div>
      {valid && (
        <p className="mt-6 text-sm text-slate-500">
          {session?.user ? "Apply" : "Sign in or create an account and apply"} from your dashboard within {settings.attributionDays} days to
          join as their recruited Partner. If you&apos;re already a Partner, this invitation doesn&apos;t change anything.
        </p>
      )}
    </main>
  );
}
