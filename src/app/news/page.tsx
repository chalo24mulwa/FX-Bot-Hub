import type { Metadata } from "next";
import { ComingSoon } from "@/components/layout/coming-soon";

export const metadata: Metadata = { title: "Forex News" };

export default function NewsPage() {
  return <ComingSoon title="Forex News" description="Curated market news will appear here." />;
}
