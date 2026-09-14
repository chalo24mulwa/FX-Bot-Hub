import type { Metadata } from "next";
import { ComingSoon } from "@/components/layout/coming-soon";

export const metadata: Metadata = { title: "Market Analysis" };

export default function AnalysisPage() {
  return <ComingSoon title="Market Analysis" description="Expert market analysis will appear here." />;
}
