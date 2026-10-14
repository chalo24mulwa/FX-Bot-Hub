import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { pageMetadata } from "@/lib/seo/site";
import { getPartnershipSettings, programmeTerms } from "@/features/partnership/core";
import { TermsView } from "@/components/partnership/terms-view";

export const dynamic = "force-dynamic";

export const metadata: Metadata = pageMetadata({
  title: "Partnership Programme Terms",
  description: "The rules of the FXBotHub Partnership Programme: eligibility, commission, referral tracking, holding periods, refunds, payouts and Master Partners.",
  path: "/partnership/terms",
});

export default async function PartnershipTermsPage() {
  const settings = await getPartnershipSettings();
  return (
    <main className="mx-auto w-full min-w-0 max-w-3xl flex-1 px-4 py-10 sm:px-6">
      <nav aria-label="Breadcrumb" className="text-sm text-slate-500">
        <ol className="flex flex-wrap items-center gap-1.5">
          <li>
            <Link href="/" className="hover:text-slate-900">
              Home
            </Link>
          </li>
          <li aria-hidden="true">
            <ChevronRight className="h-3.5 w-3.5" />
          </li>
          <li>
            <Link href="/partnership" className="hover:text-slate-900">
              Partnership
            </Link>
          </li>
          <li aria-hidden="true">
            <ChevronRight className="h-3.5 w-3.5" />
          </li>
          <li aria-current="page" className="text-slate-900">
            Terms
          </li>
        </ol>
      </nav>
      <h1 className="mt-6 text-3xl font-bold tracking-tight text-slate-900">Partnership Programme terms</h1>
      <p className="mt-2 text-sm text-slate-500">
        Last updated {settings.updatedAt.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" })}
      </p>
      <div className="mt-8">
        <TermsView text={programmeTerms(settings)} />
      </div>
    </main>
  );
}
