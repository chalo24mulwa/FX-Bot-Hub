import type { Metadata } from "next";
import { PRIVATE_PAGE_ROBOTS } from "@/lib/seo/site";

// Account, cart and invoice pages are private or user-specific: keep them out of search
// results. A pass-through layout so every page in this segment inherits the noindex.
export const metadata: Metadata = { robots: PRIVATE_PAGE_ROBOTS };

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
