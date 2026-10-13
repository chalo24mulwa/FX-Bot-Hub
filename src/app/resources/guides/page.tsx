import type { Metadata } from "next";
import { ComingSoon } from "@/components/layout/coming-soon";
import { pageMetadata } from "@/lib/seo/site";

// Placeholder ("coming soon") page: noindex until it has real content, so it isn't
// indexed as a thin page. Remove `noindex` when the section launches.
export const metadata: Metadata = pageMetadata({
  title: "Guides",
  description: "Guides from FX Bot Hub — coming soon.",
  path: "/resources/guides",
  noindex: true,
});

export default function GuidesPage() {
  return <ComingSoon title="Guides" description="Getting-started guides will appear here." />;
}
