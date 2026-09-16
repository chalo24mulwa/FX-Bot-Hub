import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { AuthSessionProvider } from "@/components/providers/session-provider";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const siteUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: { default: "fx Bot Hub", template: "%s | fx Bot Hub" },
  description:
    "A marketplace for MT4/MT5 Expert Advisors, indicators, and trading signals, with an integrated economic calendar.",
  openGraph: {
    type: "website",
    siteName: "fx Bot Hub",
    title: "fx Bot Hub",
    description:
      "A marketplace for MT4/MT5 Expert Advisors, indicators, and trading signals.",
  },
  twitter: { card: "summary_large_image" },
  robots: { index: true, follow: true },
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
        </AuthSessionProvider>
      </body>
    </html>
  );
}
