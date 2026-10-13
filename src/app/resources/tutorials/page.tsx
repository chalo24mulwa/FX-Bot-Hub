import type { Metadata } from "next";
import { ComingSoon } from "@/components/layout/coming-soon";
import { pageMetadata } from "@/lib/seo/site";

// Placeholder ("coming soon") page: noindex until it has real content, so it isn't
// indexed as a thin page. Remove `noindex` when the section launches.
export const metadata: Metadata = pageMetadata({
  title: "Tutorials",
  description: "Tutorials from FX Bot Hub — coming soon.",
  path: "/resources/tutorials",
  noindex: true,
});

export default function TutorialsPage() {
  return <ComingSoon title="Tutorials" description="Step-by-step tutorials will appear here." />;
}
