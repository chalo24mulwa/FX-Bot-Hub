"use client";

import Link from "next/link";
import type { CtaPlacement } from "@/lib/partnership/cta";

/** A normal link that also counts the click (placement only) for the admin's CTA report. */
export function CtaLink({
  href,
  placement,
  className,
  children,
  ...rest
}: { href: string; placement: CtaPlacement; className?: string; children: React.ReactNode } & Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, "href">) {
  return (
    <Link
      href={href}
      className={className}
      onClick={() => {
        try {
          void fetch("/api/partnership/cta", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ placement }),
            keepalive: true,
          }).catch(() => undefined);
        } catch {
          /* never block navigation */
        }
      }}
      {...rest}
    >
      {children}
    </Link>
  );
}
