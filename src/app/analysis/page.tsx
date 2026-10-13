import type { Metadata } from "next";
import { ComingSoon } from "@/components/layout/coming-soon";
import { pageMetadata } from "@/lib/seo/site";

// Placeholder ("coming soon") page: noindex until it has real content, so it isn't
// indexed as a thin page. Remove `noindex` when the section launches.
export const metadata: Metadata = pageMetadata({
  title: "Market Analysis",
  description: "Market Analysis from FX Bot Hub — coming soon.",
  path: "/analysis",
  noindex: true,
});

export default function AnalysisPage() {
  return <ComingSoon title="Market Analysis" description="Expert market analysis will appear here." />;
}
