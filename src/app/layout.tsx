import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { AuthSessionProvider } from "@/components/providers/session-provider";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { ReferralTracker } from "@/components/partnership/referral-tracker";
import { resolveSiteUrl } from "@/lib/site-url";
import { DEFAULT_OG_IMAGE, SITE_DESCRIPTION, SITE_NAME, SITE_TAGLINE } from "@/lib/seo/site";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Resolved defensively: a malformed env value must not fail the whole build (see site-url.ts).
const siteUrl = resolveSiteUrl();

// Pages set their own canonical via pageMetadata() — never put `alternates.canonical`
// here, or every page without its own would claim to be the homepage.
export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: { default: `${SITE_NAME} — ${SITE_TAGLINE}`, template: `%s | ${SITE_NAME}` },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  openGraph: {
    type: "website",
    siteName: SITE_NAME,
    title: `${SITE_NAME} — ${SITE_TAGLINE}`,
    description: SITE_DESCRIPTION,
    images: [DEFAULT_OG_IMAGE],
  },
  twitter: { card: "summary_large_image", images: [DEFAULT_OG_IMAGE.url] },
  // No site-wide `robots` here: pages are indexable by default, and an explicit
  // "index, follow" was also emitted on 404 pages next to Next's own "noindex".
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col bg-white text-slate-900">
        <AuthSessionProvider>
          <Header />
          {/* min-w-0: without it, a flex column's default min-width:auto lets a
              wide descendant (e.g. the calendar's day table) push this whole
              chain wider than the viewport instead of scrolling within its own
              overflow-x-auto container — a no-op for every page whose content
              already fits, since it only removes an implicit width floor. */}
          <div className="flex min-w-0 flex-1 flex-col">{children}</div>
          <Footer />
          <ReferralTracker />
        </AuthSessionProvider>
      </body>
    </html>
  );
}
