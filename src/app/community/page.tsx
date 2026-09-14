import type { Metadata } from "next";
import { ComingSoon } from "@/components/layout/coming-soon";

export const metadata: Metadata = { title: "Community" };

export default function CommunityPage() {
  return <ComingSoon title="Community" description="Forums and discussion will appear here." />;
}
