/**
 * "Be Our Partner" calls to action. Pure and unit-tested: what a CTA says and
 * where it goes depends on the viewer's real Partnership status, so nobody is
 * invited to apply for something they already have.
 */

export type ViewerPartnerState = {
  signedIn: boolean;
  status: "PENDING" | "APPROVED" | "REJECTED" | "SUSPENDED" | null;
  masterStatus: "NOT_APPLIED" | "PENDING" | "APPROVED" | "REJECTED" | "SUSPENDED" | null;
  programmeOpen: boolean;
};

export type CtaKind = "join" | "info" | "reapply" | "pending" | "suspended" | "partner" | "master";

export interface Cta {
  kind: CtaKind;
  label: string;
  href: string;
}

export const APPLY_PATH = "/dashboard/partnership";
export const LANDING_PATH = "/partnership";

export function ctaFor(v: ViewerPartnerState): Cta {
  if (!v.signedIn) {
    return v.programmeOpen
      ? { kind: "join", label: "Be Our Partner", href: LANDING_PATH }
      : { kind: "info", label: "About the Partner Programme", href: LANDING_PATH };
  }
  switch (v.status) {
    case "PENDING":
      return { kind: "pending", label: "View Partnership application", href: APPLY_PATH };
    case "SUSPENDED":
      return { kind: "suspended", label: "View Partnership status", href: APPLY_PATH };
    case "APPROVED":
      return v.masterStatus === "APPROVED"
        ? { kind: "master", label: "Master Partner tools", href: "/dashboard/partnership/master" }
        : { kind: "partner", label: "Partnership dashboard", href: APPLY_PATH };
    case "REJECTED":
      return v.programmeOpen
        ? { kind: "reapply", label: "Apply again to be a Partner", href: APPLY_PATH }
        : { kind: "info", label: "View Partnership status", href: APPLY_PATH };
    default:
      return v.programmeOpen
        ? { kind: "join", label: "Be Our Partner", href: APPLY_PATH }
        : { kind: "info", label: "About the Partner Programme", href: LANDING_PATH };
  }
}

/** Is this viewer someone we should be inviting to join (rather than a member)? */
export const isInvitation = (c: Cta) => c.kind === "join" || c.kind === "reapply";

/** Where each CTA sits — the only values the click tracker accepts. */
export const CTA_PLACEMENTS = [
  "header",
  "header-mobile",
  "home",
  "marketplace",
  "product",
  "guides",
  "tutorials",
  "developer-resources",
  "community",
  "dashboard",
  "seller-dashboard",
  "landing",
] as const;
export type CtaPlacement = (typeof CTA_PLACEMENTS)[number];

export function isCtaPlacement(v: unknown): v is CtaPlacement {
  return typeof v === "string" && (CTA_PLACEMENTS as readonly string[]).includes(v);
}

/**
 * A post-sign-in destination taken from a URL parameter: only a same-site
 * path ("/x", never "//host" or "/\\host" or a full URL), so it can't be used
 * as an open redirect. Anything else falls back.
 */
export function safeCallbackPath(raw: unknown, fallback = "/marketplace"): string {
  if (typeof raw !== "string" || raw.length > 300) return fallback;
  if (!raw.startsWith("/") || raw.startsWith("//") || raw.startsWith("/\\")) return fallback;
  if (/[\r\n\t]/.test(raw) || /^\/[^/]*:/.test(raw)) return fallback;
  return raw;
}
