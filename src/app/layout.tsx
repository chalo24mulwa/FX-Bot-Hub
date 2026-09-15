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
  title: { default: "FX BOT Hub", template: "%s | FX BOT Hub" },
  description:
    "A marketplace for MT4/MT5 Expert Advisors, indicators, and trading signals, with an integrated economic calendar.",
  openGraph: {
    type: "website",
    siteName: "FX BOT Hub",
    title: "FX BOT Hub",
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
          <div className="flex flex-1 flex-col">{children}</div>
          <Footer />
        </AuthSessionProvider>
      </body>
    </html>
  );
}
