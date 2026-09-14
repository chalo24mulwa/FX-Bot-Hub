import type { Metadata } from "next";
import { ComingSoon } from "@/components/layout/coming-soon";

export const metadata: Metadata = { title: "Tutorials" };

export default function TutorialsPage() {
  return <ComingSoon title="Tutorials" description="Step-by-step tutorials will appear here." />;
}
