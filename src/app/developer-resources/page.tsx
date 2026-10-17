import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { CtaLink } from "@/components/partnership/cta-link";
import {
  ArrowRight,
  BookOpen,
  ChevronRight,
  CircleHelp,
  ClipboardCheck,
  Cpu,
  ExternalLink,
  FileCode,
  KeyRound,
  LifeBuoy,
  Milestone,
  ShieldCheck,
  Store,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { pageMetadata } from "@/lib/seo/site";
import { resolveSiteUrl } from "@/lib/site-url";
import { UPLOAD_LIMITS } from "@/lib/storage/validate-upload";
import { marketplaceLandingPath } from "@/lib/seo/marketplace-landing";

// Everything on this page describes features that exist in this codebase today (seller
// onboarding, the product wizard, upload limits from validate-upload.ts, the license API
// in src/app/api/licenses). Anything not built yet lives in the "Roadmap" section and is
// labelled as planned — don't move an item out of it until the feature actually ships.

const PATH = "/developer-resources";
const DESCRIPTION =
  "Explore FXBotHub developer resources for MQL4 and MQL5 Expert Advisors, forex indicators, seller onboarding, product publishing and trading software development.";

export const metadata: Metadata = {
  ...pageMetadata({ title: "Developer Resources for Forex Tools & EA Sellers", description: DESCRIPTION, path: PATH }),
  title: { absolute: "Developer Resources for Forex Tools & EA Sellers | FXBotHub" },
};

const MB = 1024 * 1024;
const sizeLabel = (bytes: number) => `${Math.round(bytes / MB)} MB`;
const extLabel = (exts: readonly string[]) => exts.join(", ");

const RESOURCES = [
  {
    id: "mql4",
    icon: FileCode,
    title: "MQL4 Development",
    body: "Build and package Expert Advisors and indicators for MetaTrader 4, with links to the official MQL4 reference.",
  },
  {
    id: "mql5",
    icon: Cpu,
    title: "MQL5 Development",
    body: "Resources for MetaTrader 5 trading robots, indicators and automation, and how MT5 products are listed here.",
  },
  {
    id: "api",
    icon: KeyRound,
    title: "API Documentation",
    body: "The license verification API your EA can call to check a buyer's license key and activation slots.",
  },
  {
    id: "seller-onboarding",
    icon: Store,
    title: "Seller Onboarding",
    body: "Register, become a seller, build a listing in the product wizard and submit it for review.",
  },
  {
    id: "submission-guidelines",
    icon: ClipboardCheck,
    title: "Product Submission Guidelines",
    body: "Accepted file types and sizes, screenshots, descriptions, version numbers and compatibility details.",
  },
  {
    id: "security",
    icon: ShieldCheck,
    title: "Security and Best Practices",
    body: "Secure distribution, testing before release and keeping credentials out of your trading software.",
  },
  {
    id: "faq",
    icon: CircleHelp,
    title: "Developer FAQs",
    body: "Supported platforms, listing requirements, pricing options and how product updates reach buyers.",
  },
] as const;

const WIZARD_STEPS = [
  "Product type",
  "Platform",
  "Basic information",
  "Description",
  "Screenshots",
  "Files",
  "Pricing",
  "Compatibility",
  "Submit for review",
];

const LICENSE_ENDPOINTS = [
  {
    method: "POST",
    path: "/api/licenses/verify",
    body: `{ "licenseKey": "…" }`,
    returns:
      "valid, status, productId, expiresAt, activeActivations and maxActivations — or valid: false with status NOT_FOUND for an unknown key.",
  },
  {
    method: "POST",
    path: "/api/licenses/activate",
    body: `{ "licenseKey": "…", "machineId": "…" }`,
    returns: "activated: true with activatedAt, or activated: false with an error when the key is unusable or every activation slot is taken.",
  },
  {
    method: "POST",
    path: "/api/licenses/deactivate",
    body: `{ "licenseKey": "…", "machineId": "…" }`,
    returns: "deactivated: true, freeing that machine's slot so the buyer can activate elsewhere.",
  },
];

const FAQS: { q: string; a: ReactNode }[] = [
  {
    q: "Which platforms and product types can I list?",
    a: "Expert Advisors, indicators, signal tools, trading tools and other MetaTrader products, built for MetaTrader 4, MetaTrader 5 or both (choose Multi-platform in the wizard).",
  },
  {
    q: "Do I need approval to start selling?",
    a: (
      <>
        No — becoming a seller is instant and self-service from{" "}
        <Link className="text-violet-300 underline-offset-4 hover:underline" href="/dashboard/become-seller">
          Become a seller
        </Link>
        . Each product is reviewed before it goes live: a moderator either publishes it or rejects it with a
        reason you can address and resubmit.
      </>
    ),
  },
  {
    q: "How long does product review take?",
    a: "There is no fixed review timeline. You are notified of the outcome in your account notifications.",
  },
  {
    q: "Can I offer free products or subscriptions?",
    a: "Yes. Products can be free, a one-time purchase, or a subscription billed roughly every 30 days until the buyer or seller cancels.",
  },
  {
    q: "How do I publish an update?",
    a: "Upload the new build as a new version with its version number and changelog. Buyers who favourited your product are notified when a new version is released.",
  },
  {
    q: "Can I upload MQL source code?",
    a: "Yes — .mq4 and .mq5 files are accepted alongside compiled .ex4/.ex5 builds. Whether to ship source is your decision; buyers can only download files after purchase.",
  },
  {
    q: "What does selling cost?",
    a: (
      <>
        Each sale records the marketplace commission at the current rate in your seller ledger, alongside the sale
        itself, so your balance always shows exactly what you have earned. You can see this on your Payout page
        once you are a seller.
      </>
    ),
  },
];

const ROADMAP = [
  {
    title: "Public catalogue and seller APIs",
    body: "Read access to published listings and an API for managing your own products. Not available yet — today the license API is the only public developer API.",
  },
  {
    title: "MQL code samples for the license API",
    body: "Ready-to-use MQL4 and MQL5 examples showing verify and activate calls with WebRequest.",
  },
  {
    title: "Developer-focused guides",
    body: "Walkthroughs for packaging and documenting EAs and indicators. Installing and backtesting are already covered in Tutorials, and selling in the Guides section.",
  },
  {
    title: "Dedicated developer support channel",
    body: "A direct support contact for sellers. Until it launches, use the Community (see Support below).",
  },
  {
    title: "Automated seller payouts",
    body: "Payouts are currently requested from your Payout page and processed manually once funds have moved.",
  },
];

function breadcrumbJsonLd() {
  const site = resolveSiteUrl().replace(/\/$/, "");
  const data = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: site },
      { "@type": "ListItem", position: 2, name: "Developer Resources", item: `${site}${PATH}` },
    ],
  };
  return JSON.stringify(data).replace(/</g, "\\u003c");
}

const primaryCta =
  "inline-flex items-center justify-center gap-2 rounded-lg bg-violet-500 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-violet-950/40 transition hover:bg-violet-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-300 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a1030]";
const secondaryCta =
  "inline-flex items-center justify-center gap-2 rounded-lg border border-white/15 bg-white/5 px-5 py-3 text-sm font-semibold text-slate-100 transition hover:border-amber-300/50 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a1030]";
const inlineLink = "font-medium text-violet-300 underline-offset-4 hover:text-violet-200 hover:underline";

function ExternalDocLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className={cn(inlineLink, "inline-flex items-center gap-1")}>
      {children}
      <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
      <span className="sr-only">(opens in a new tab)</span>
    </a>
  );
}

function Section({
  id,
  icon: Icon,
  eyebrow,
  title,
  children,
}: {
  id: string;
  icon: typeof BookOpen;
  eyebrow: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className="min-w-0 scroll-mt-24 rounded-2xl border border-white/10 bg-white/[0.03] p-6 sm:p-8">
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-violet-500/15 text-violet-300 ring-1 ring-violet-400/20">
          <Icon className="h-5 w-5" aria-hidden="true" />
        </span>
        <p className="text-xs font-semibold uppercase tracking-wider text-amber-300/90">{eyebrow}</p>
      </div>
      <h2 id={`${id}-title`} className="mt-4 text-2xl font-semibold tracking-tight text-white">
        {title}
      </h2>
      <div className="mt-4 space-y-4 text-[15px] leading-relaxed text-slate-300">{children}</div>
    </section>
  );
}

export default function DeveloperResourcesPage() {
  return (
    <main
      className="w-full min-w-0 flex-1 bg-[#070c1d] text-slate-200"
      style={{
        backgroundImage:
          "radial-gradient(55% 40% at 10% 0%, rgba(139,92,246,0.22), transparent 70%), radial-gradient(40% 35% at 95% 4%, rgba(245,158,11,0.12), transparent 70%), linear-gradient(180deg, #080e24 0%, #0a1030 50%, #0c1236 100%)",
      }}
    >
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: breadcrumbJsonLd() }} />

      <div className="mx-auto w-full max-w-6xl px-4 pb-20 pt-6 sm:px-6">
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
              Developer Resources
            </li>
          </ol>
        </nav>

        {/* Hero */}
        <header className="mt-10 max-w-3xl">
          <p className="inline-flex items-center gap-2 rounded-full border border-amber-300/25 bg-amber-300/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-amber-200">
            For MT4 &amp; MT5 developers
          </p>
          <h1 className="mt-5 text-4xl font-bold tracking-tight text-white sm:text-5xl">FXBotHub Developer Resources</h1>
          <p className="mt-5 text-lg leading-relaxed text-slate-300">
            Build, publish and grow your forex trading tools with FXBotHub. Explore resources for Expert Advisor
            developers, indicator creators, signal providers and technology partners building for the MetaTrader
            ecosystem.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/dashboard/become-seller" className={primaryCta}>
              Become a Seller <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
            <Link href="/marketplace" className={secondaryCta}>
              Browse Trading Tools
            </Link>
            <Link href="#mql4" className={secondaryCta}>
              Explore MQL4 Resources
            </Link>
            <Link href="#mql5" className={secondaryCta}>
              Explore MQL5 Resources
            </Link>
            <Link href="#support" className={secondaryCta}>
              <LifeBuoy className="h-4 w-4" aria-hidden="true" /> Contact Support
            </Link>
          </div>
        </header>

        {/* Resource cards */}
        <section aria-labelledby="resources-title" className="mt-16">
          <h2 id="resources-title" className="text-xl font-semibold text-white">
            Explore forex developer resources
          </h2>
          <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {RESOURCES.map(({ id, icon: Icon, title, body }) => (
              <li key={id}>
                <Link
                  href={`#${id}`}
                  className="group flex h-full flex-col rounded-xl border border-white/10 bg-white/[0.04] p-5 transition hover:-translate-y-0.5 hover:border-violet-400/40 hover:bg-white/[0.07] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-300 motion-reduce:transition-none motion-reduce:hover:translate-y-0"
                >
                  <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-violet-500/15 text-violet-300 ring-1 ring-violet-400/20 transition group-hover:text-amber-300">
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <h3 className="mt-4 text-base font-semibold text-white">{title}</h3>
                  <p className="mt-2 flex-1 text-sm leading-relaxed text-slate-400">{body}</p>
                  <span className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-violet-300 group-hover:text-violet-200">
                    Read more <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" aria-hidden="true" />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>

        {/* grid-cols-1 = minmax(0,1fr): lets the wide tables scroll inside their own box on phones
            instead of stretching the whole column (and the page) sideways. */}
        <div className="mt-16 grid grid-cols-1 gap-6">
          <Section id="mql4" icon={FileCode} eyebrow="MetaTrader 4" title="MQL4 development resources">
            <p>
              MetaTrader 4 Expert Advisors and indicators are written in MQL4 and compiled in MetaEditor. On FXBotHub
              you can list compiled <code className="text-amber-200">.ex4</code> builds, MQL4 source (
              <code className="text-amber-200">.mq4</code>), preset files (<code className="text-amber-200">.set</code>)
              or a <code className="text-amber-200">.zip</code> package, and mark the listing as MT4 or Multi-platform.
            </p>
            <ul className="list-disc space-y-1.5 pl-5">
              <li>
                <ExternalDocLink href="https://docs.mql4.com/">MQL4 Reference (official MetaQuotes documentation)</ExternalDocLink>
              </li>
              <li>
                <ExternalDocLink href="https://www.metatrader4.com/en/trading-platform/help/autotrading/tester">
                  MetaTrader 4 Strategy Tester help
                </ExternalDocLink>
              </li>
            </ul>
            <p>
              See what is already listed:{" "}
              <Link className={inlineLink} href={marketplaceLandingPath({ platform: "MT4", type: "EA" })}>
                MT4 Expert Advisors
              </Link>{" "}
              and{" "}
              <Link className={inlineLink} href={marketplaceLandingPath({ platform: "MT4", type: "INDICATOR" })}>
                MT4 indicators
              </Link>
              .
            </p>
          </Section>

          <Section id="mql5" icon={Cpu} eyebrow="MetaTrader 5" title="MQL5 development resources">
            <p>
              MetaTrader 5 trading robots, indicators and scripts are written in MQL5. List compiled{" "}
              <code className="text-amber-200">.ex5</code> builds, MQL5 source (<code className="text-amber-200">.mq5</code>),{" "}
              <code className="text-amber-200">.set</code> presets or a <code className="text-amber-200">.zip</code>{" "}
              package, marked as MT5 or Multi-platform. A single version can carry several files, for example separate
              MT4 and MT5 builds of the same product.
            </p>
            <ul className="list-disc space-y-1.5 pl-5">
              <li>
                <ExternalDocLink href="https://www.mql5.com/en/docs">MQL5 Reference (official MetaQuotes documentation)</ExternalDocLink>
              </li>
              <li>
                <ExternalDocLink href="https://www.metatrader5.com/en/terminal/help/algotrading/testing">
                  MetaTrader 5 Strategy Tester help
                </ExternalDocLink>
              </li>
            </ul>
            <p>
              Browse{" "}
              <Link className={inlineLink} href={marketplaceLandingPath({ platform: "MT5", type: "EA" })}>
                MT5 Expert Advisors
              </Link>
              ,{" "}
              <Link className={inlineLink} href={marketplaceLandingPath({ platform: "MT5", type: "INDICATOR" })}>
                MT5 indicators
              </Link>{" "}
              and all{" "}
              <Link className={inlineLink} href={marketplaceLandingPath({ type: "INDICATOR" })}>
                forex indicators
              </Link>
              .
            </p>
          </Section>

          <Section id="api" icon={KeyRound} eyebrow="Integration" title="API documentation: license verification">
            <p>
              Every purchase on FXBotHub issues the buyer a license key. Your Expert Advisor can check that key against
              FXBotHub with three JSON endpoints. No session or secret is needed — the buyer&apos;s license key is the
              credential — and requests are rate-limited per IP address.
            </p>
            <ul className="grid gap-3">
              {LICENSE_ENDPOINTS.map((e) => (
                <li key={e.path} className="min-w-0 rounded-xl border border-white/10 bg-[#0b1233]/70 p-4">
                  <p className="flex flex-wrap items-center gap-2 font-mono text-[13px] text-slate-100">
                    <span className="rounded bg-amber-300/15 px-1.5 py-0.5 text-[11px] font-semibold text-amber-200">{e.method}</span>
                    <span className="break-all">{e.path}</span>
                  </p>
                  <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-[110px_minmax(0,1fr)]">
                    <dt className="text-slate-400">JSON body</dt>
                    <dd className="break-all font-mono text-[13px] text-violet-200">{e.body}</dd>
                    <dt className="text-slate-400">Response</dt>
                    <dd className="text-slate-300">{e.returns}</dd>
                  </dl>
                </li>
              ))}
            </ul>
            <ul className="list-disc space-y-1.5 pl-5">
              <li>
                <code className="text-amber-200">machineId</code> is a stable identifier you choose for the buyer&apos;s
                terminal or machine (up to 200 characters). Each license has a limited number of activation slots.
              </li>
              <li>
                Calls from MQL use <code className="text-amber-200">WebRequest</code>, which only works once the buyer
                adds the FXBotHub address to the allowed URLs in the terminal&apos;s Expert Advisors options. Per
                MetaQuotes&apos; documentation it can&apos;t be called from indicators or in the Strategy Tester — see{" "}
                <ExternalDocLink href="https://docs.mql4.com/common/webrequest">MQL4 WebRequest</ExternalDocLink> and{" "}
                <ExternalDocLink href="https://www.mql5.com/en/docs/network/webrequest">MQL5 WebRequest</ExternalDocLink>.
              </li>
              <li>
                License checks confirm a key is valid; they are not copy protection built into your compiled file. Plan
                your product&apos;s protection with that in mind.
              </li>
            </ul>
            <p className="rounded-lg border border-amber-300/20 bg-amber-300/5 px-4 py-3 text-sm text-amber-100">
              This is FXBotHub&apos;s only public developer API today. Catalogue and seller-management APIs are on the{" "}
              <Link href="#roadmap" className="underline underline-offset-4 hover:text-white">
                roadmap
              </Link>
              .
            </p>
          </Section>

          <Section id="seller-onboarding" icon={Store} eyebrow="Get started" title="Seller onboarding: from account to published listing">
            <ol className="space-y-4">
              {[
                <>
                  <strong className="text-white">Create a free account.</strong>{" "}
                  <Link className={inlineLink} href="/auth/sign-up">
                    Sign up
                  </Link>{" "}
                  with your email, or sign in if you already have one.
                </>,
                <>
                  <strong className="text-white">Become a seller.</strong> Choose a seller or business display name on{" "}
                  <Link className={inlineLink} href="/dashboard/become-seller">
                    Become a seller
                  </Link>
                  . It&apos;s instant and opens your seller dashboard.
                </>,
                <>
                  <strong className="text-white">Build your listing.</strong> The product wizard saves a draft you can
                  resume at any time and walks through: {WIZARD_STEPS.join(" → ")}.
                </>,
                <>
                  <strong className="text-white">Submit for review.</strong> A moderator reviews each product, then
                  publishes it or rejects it with a reason you can fix and resubmit. Nothing is public until it is
                  approved.
                </>,
                <>
                  <strong className="text-white">Grow after launch.</strong> Track orders, analytics, reviews and your
                  earnings ledger from the seller dashboard, and reply publicly to buyer reviews.
                </>,
              ].map((step, i) => (
                <li key={i} className="flex gap-4">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-amber-300/15 text-sm font-semibold text-amber-200">
                    {i + 1}
                  </span>
                  <p>{step}</p>
                </li>
              ))}
            </ol>
            <div className="pt-2">
              <Link href="/dashboard/become-seller" className={primaryCta}>
                Become a Seller <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            </div>
          </Section>

          <Section id="submission-guidelines" icon={ClipboardCheck} eyebrow="Listing requirements" title="Product submission guidelines">
            <p>Uploads are checked against these limits before they are accepted:</p>
            <div className="overflow-x-auto rounded-xl border border-white/10">
              <table className="w-full min-w-[520px] text-left text-sm">
                <caption className="sr-only">Accepted upload types and size limits</caption>
                <thead className="bg-white/5 text-xs uppercase tracking-wider text-slate-400">
                  <tr>
                    <th scope="col" className="px-4 py-3">Upload</th>
                    <th scope="col" className="px-4 py-3">Accepted files</th>
                    <th scope="col" className="px-4 py-3">Max size</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10 text-slate-300">
                  <tr>
                    <th scope="row" className="px-4 py-3 font-medium text-white">Product files</th>
                    <td className="px-4 py-3 font-mono text-[13px]">{extLabel(UPLOAD_LIMITS.productFile.extensions)}</td>
                    <td className="px-4 py-3">{sizeLabel(UPLOAD_LIMITS.productFile.maxBytes)}</td>
                  </tr>
                  <tr>
                    <th scope="row" className="px-4 py-3 font-medium text-white">Cover photo &amp; screenshots</th>
                    <td className="px-4 py-3 font-mono text-[13px]">{extLabel(UPLOAD_LIMITS.image.extensions)}</td>
                    <td className="px-4 py-3">{sizeLabel(UPLOAD_LIMITS.image.maxBytes)}</td>
                  </tr>
                  <tr>
                    <th scope="row" className="px-4 py-3 font-medium text-white">Documentation</th>
                    <td className="px-4 py-3 font-mono text-[13px]">{extLabel(UPLOAD_LIMITS.documentation.extensions)}</td>
                    <td className="px-4 py-3">{sizeLabel(UPLOAD_LIMITS.documentation.maxBytes)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <ul className="list-disc space-y-1.5 pl-5">
              <li>
                <strong className="text-white">Name and summary:</strong> a product name of 3–120 characters and a short
                summary of 10–200 characters that says plainly what the tool does.
              </li>
              <li>
                <strong className="text-white">Description and features:</strong> a full description plus up to 20
                feature bullet points and up to 10 tags.
              </li>
              <li>
                <strong className="text-white">Screenshots:</strong> real charts and settings from your product. A cover
                photo is recommended — it is shown above your title across the marketplace.
              </li>
              <li>
                <strong className="text-white">Versions:</strong> every upload belongs to a version number (for example
                1.0.0) with an optional changelog, so buyers can see what changed.
              </li>
              <li>
                <strong className="text-white">Compatibility:</strong> state the platform (MT4, MT5 or both), requirements,
                installation instructions, compatibility notes and how buyers get support.
              </li>
              <li>
                <strong className="text-white">Pricing:</strong> free, a one-time price, or a subscription.
              </li>
            </ul>
            <p>
              Published listings show buyers a quality checklist — documentation, screenshots, compatibility details,
              recent updates, verified-seller status and verified-purchase reviews — which also feeds marketplace
              ranking. It reflects listing completeness, not trading performance.
            </p>
          </Section>

          <Section id="security" icon={ShieldCheck} eyebrow="Trust" title="Security and best practices">
            <ul className="list-disc space-y-2 pl-5">
              <li>
                <strong className="text-white">Secure distribution:</strong> your files upload directly to private storage
                with a checksum recorded automatically. Buyers can only download after purchase, through short-lived
                links that are re-checked on every request.
              </li>
              <li>
                <strong className="text-white">No secrets in your build:</strong> never embed broker logins, account
                passwords, API keys or private server credentials in an EA, indicator or preset file. Use the{" "}
                <Link className={inlineLink} href="#api">
                  license API
                </Link>{" "}
                for license checks instead of hard-coded keys.
              </li>
              <li>
                <strong className="text-white">Test before you publish:</strong> backtest in the Strategy Tester and run
                forward tests on a demo account; document the symbols, timeframes and settings you tested.
              </li>
              <li>
                <strong className="text-white">Describe risk honestly:</strong> don&apos;t promise profits or guaranteed
                results. Forex trading carries risk, and listings should help buyers make informed decisions.
              </li>
              <li>
                <strong className="text-white">Keep products current:</strong> publish fixes as new versions with a
                changelog so buyers know what changed.
              </li>
            </ul>
          </Section>

          <Section id="faq" icon={CircleHelp} eyebrow="Questions" title="Developer FAQs">
            <div className="divide-y divide-white/10 rounded-xl border border-white/10">
              {FAQS.map(({ q, a }) => (
                <details key={q} className="group px-5 py-4 [&_summary::-webkit-details-marker]:hidden">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-medium text-white">
                    <h3 className="text-base">{q}</h3>
                    <ChevronRight className="h-4 w-4 shrink-0 text-slate-400 transition group-open:rotate-90" aria-hidden="true" />
                  </summary>
                  <div className="mt-3 text-slate-300">{a}</div>
                </details>
              ))}
            </div>
          </Section>

          <Section id="roadmap" icon={Milestone} eyebrow="Planned" title="Developer roadmap">
            <p>These resources are planned but not available yet:</p>
            <ul className="grid gap-3 sm:grid-cols-2">
              {ROADMAP.map((item) => (
                <li key={item.title} className="rounded-xl border border-dashed border-white/15 bg-white/[0.02] p-4">
                  <p className="flex items-center gap-2 font-medium text-white">
                    <span className="rounded bg-violet-500/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-violet-200">
                      Planned
                    </span>
                    {item.title}
                  </p>
                  <p className="mt-1.5 text-sm text-slate-400">{item.body}</p>
                </li>
              ))}
            </ul>
          </Section>

          <Section id="support" icon={LifeBuoy} eyebrow="Help" title="Contact support">
            <p>
              A dedicated developer support contact is planned. In the meantime, ask your questions in the FXBotHub
              Community, where other developers and traders can help:
            </p>
            <div className="flex flex-wrap gap-3">
              <Link href="/community/c/expert-advisors" className={secondaryCta}>
                Expert Advisors forum
              </Link>
              <Link href="/community/c/indicators" className={secondaryCta}>
                Indicators forum
              </Link>
              <Link href="/community/c/general-discussion" className={secondaryCta}>
                General discussion
              </Link>
            </div>
            <p className="text-sm text-slate-400">
              Questions about a specific product go to its seller through the Contact seller button on the product page.
            </p>
          </Section>
        </div>

        {/* Closing CTA */}
        <section className="mt-16 overflow-hidden rounded-2xl border border-violet-400/20 bg-gradient-to-br from-violet-600/25 via-[#101641] to-amber-500/10 p-8 text-center sm:p-12">
          <h2 className="text-2xl font-semibold text-white sm:text-3xl">Ready to sell your MT4 and MT5 trading tools?</h2>
          <p className="mx-auto mt-3 max-w-2xl text-slate-300">
            Join the FXBotHub marketplace for Expert Advisors and forex indicators — set up takes minutes, and every
            listing is reviewed before it goes live.
          </p>
          <div className="mt-7 flex flex-wrap justify-center gap-3">
            <Link href="/dashboard/become-seller" className={primaryCta}>
              Become a Seller <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
            <Link href="/marketplace" className={secondaryCta}>
              Browse Trading Tools
            </Link>
          </div>
          <p className="mt-6 text-sm text-slate-400">
            Not selling, but recommending tools to other traders?{" "}
            <CtaLink href="/partnership" placement="developer-resources" className="font-medium text-amber-200 underline underline-offset-4 hover:text-amber-100">
              Become an FXBotHub Partner
            </CtaLink>
            .
          </p>
        </section>
      </div>
    </main>
  );
}
