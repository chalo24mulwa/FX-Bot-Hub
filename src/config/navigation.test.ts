import { describe, expect, it } from "vitest";
import { MENU_BAR_LINKS, PRIMARY_NAV } from "./navigation";

// A stand-alone menu-bar link is placed by matching its `after` text to a group's label. If a group is
// renamed and `after` isn't, the link silently disappears from the header and the phone menu.
describe("navigation", () => {
  it("places every stand-alone menu-bar link behind a group that exists", () => {
    const labels = PRIMARY_NAV.map((group) => group.label);
    for (const link of MENU_BAR_LINKS) expect(labels, `"${link.label}" is placed after "${link.after}"`).toContain(link.after);
  });

  it("calls the market overview group \"Insights\" and keeps its page at /intelligence", () => {
    const group = PRIMARY_NAV.find((g) => g.label === "Insights");
    expect(group?.links).toContainEqual({ label: "Dashboard", href: "/intelligence" });
    expect(PRIMARY_NAV.some((g) => g.label === "Market Intelligence")).toBe(false);
  });

  it("has no duplicate hrefs or labels in the menu bar", () => {
    const hrefs = MENU_BAR_LINKS.map((l) => l.href);
    expect(new Set(hrefs).size).toBe(hrefs.length);
  });
});
