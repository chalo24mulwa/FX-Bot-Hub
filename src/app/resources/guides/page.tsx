import type { Metadata } from "next";
import { ComingSoon } from "@/components/layout/coming-soon";

export const metadata: Metadata = { title: "Guides" };

export default function GuidesPage() {
  return <ComingSoon title="Guides" description="Getting-started guides will appear here." />;
}
