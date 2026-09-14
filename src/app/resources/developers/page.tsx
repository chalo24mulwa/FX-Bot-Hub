import type { Metadata } from "next";
import { ComingSoon } from "@/components/layout/coming-soon";

export const metadata: Metadata = { title: "Developer Resources" };

export default function DeveloperResourcesPage() {
  return (
    <ComingSoon title="Developer Resources" description="API docs and seller onboarding guides will appear here." />
  );
}
