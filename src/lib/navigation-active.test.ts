import { describe, expect, it } from "vitest";
import { PRIMARY_NAV } from "@/config/navigation";
import { hrefPath, isGroupCurrent, isLinkCurrent } from "./navigation-active";

describe("navigation active states", () => {
  it("strips query and hash from an href", () => {
    expect(hrefPath("/marketplace?platform=MT4&type=EA")).toBe("/marketplace");
    expect(hrefPath("/guides#top")).toBe("/guides");
    expect(hrefPath("/calendar")).toBe("/calendar");
  });

  it("marks a plain link current on its page and beneath it, but not on look-alike paths", () => {
    expect(isLinkCurrent("/calendar", "/calendar")).toBe(true);
    expect(isLinkCurrent("/guides/what-is-a-forex-expert-advisor", "/guides")).toBe(true);
    expect(isLinkCurrent("/calendar-extra", "/calendar")).toBe(false);
    expect(isLinkCurrent("/news", "/calendar")).toBe(false);
    expect(isLinkCurrent("/", "/")).toBe(true);
    expect(isLinkCurrent("/community", "/")).toBe(false);
  });

  it("never marks a link with a query string current (the path alone can't tell them apart)", () => {
    expect(isLinkCurrent("/marketplace", "/marketplace?platform=MT4&type=EA")).toBe(false);
  });

  it("marks a group current anywhere under any of its links' paths", () => {
    const find = (label: string) => PRIMARY_NAV.find((g) => g.label === label)!.links;
    expect(isGroupCurrent("/marketplace", find("Marketplace"))).toBe(true);
    expect(isGroupCurrent("/marketplace/some-ea", find("Marketplace"))).toBe(true);
    expect(isGroupCurrent("/signals", find("Insights"))).toBe(true);
    expect(isGroupCurrent("/intelligence", find("Insights"))).toBe(true);
    expect(isGroupCurrent("/tutorials/install-ea-mt5", find("Resources"))).toBe(true);
    expect(isGroupCurrent("/cart", find("Marketplace"))).toBe(false);
    expect(isGroupCurrent("/community", find("Insights"))).toBe(false);
  });
});
