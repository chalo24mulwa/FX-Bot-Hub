import { describe, expect, it } from "vitest";
import { ctaFor, isCtaPlacement, isInvitation, safeCallbackPath, type ViewerPartnerState } from "./cta";

const v = (over: Partial<ViewerPartnerState>): ViewerPartnerState => ({ signedIn: true, status: null, masterStatus: null, programmeOpen: true, ...over });

describe("status-aware partnership CTA", () => {
  it("invites visitors and non-members, and sends members to their dashboard", () => {
    expect(ctaFor(v({ signedIn: false }))).toEqual({ kind: "join", label: "Be Our Partner", href: "/partnership" });
    expect(ctaFor(v({}))).toEqual({ kind: "join", label: "Be Our Partner", href: "/dashboard/partnership" });
    expect(ctaFor(v({ status: "PENDING" }))).toMatchObject({ kind: "pending", label: "View Partnership application" });
    expect(ctaFor(v({ status: "APPROVED", masterStatus: "NOT_APPLIED" }))).toMatchObject({ kind: "partner", href: "/dashboard/partnership" });
    expect(ctaFor(v({ status: "APPROVED", masterStatus: "APPROVED" }))).toMatchObject({ kind: "master", href: "/dashboard/partnership/master" });
    expect(ctaFor(v({ status: "SUSPENDED", masterStatus: "APPROVED" }))).toMatchObject({ kind: "suspended", label: "View Partnership status" });
    expect(ctaFor(v({ status: "REJECTED" }))).toMatchObject({ kind: "reapply" });
  });

  it("never invites anyone to apply while applications are paused", () => {
    for (const state of [v({ signedIn: false, programmeOpen: false }), v({ programmeOpen: false }), v({ status: "REJECTED", programmeOpen: false })]) {
      expect(isInvitation(ctaFor(state))).toBe(false);
    }
    expect(ctaFor(v({ status: "APPROVED", programmeOpen: false })).kind).toBe("partner");
  });

  it("only accepts known placements", () => {
    expect(isCtaPlacement("home")).toBe(true);
    expect(isCtaPlacement("<script>")).toBe(false);
    expect(isCtaPlacement(3)).toBe(false);
  });

  it("only allows same-site callback paths", () => {
    expect(safeCallbackPath("/dashboard/partnership")).toBe("/dashboard/partnership");
    expect(safeCallbackPath("/dashboard/partnership?x=1")).toBe("/dashboard/partnership?x=1");
    for (const bad of ["//evil.example", "/\\evil.example", "https://evil.example", "javascript:alert(1)", "/a\nb", "", undefined, "/x".repeat(200)]) {
      expect(safeCallbackPath(bad)).toBe("/marketplace");
    }
  });
});
