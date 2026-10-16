import { describe, expect, it } from "vitest";
import { nextBarVisibility } from "./scroll-direction";

const base = { barHeight: 49, maxY: 5000 };

describe("nextBarVisibility", () => {
  it("stays visible at the top of the page, including iOS pull-down overscroll", () => {
    expect(nextBarVisibility({ ...base, y: 0, lastY: 30, visible: false })).toBe(true);
    expect(nextBarVisibility({ ...base, y: -40, lastY: 0, visible: false })).toBe(true);
  });

  it("stays visible until the page has scrolled past the bar, even scrolling down", () => {
    expect(nextBarVisibility({ ...base, y: 30, lastY: 0, visible: true })).toBe(true);
    expect(nextBarVisibility({ ...base, y: 49, lastY: 20, visible: true })).toBe(true);
  });

  it("hides when scrolling down past the bar", () => {
    expect(nextBarVisibility({ ...base, y: 120, lastY: 100, visible: true })).toBe(false);
    expect(nextBarVisibility({ ...base, y: 800, lastY: 700, visible: true })).toBe(false);
  });

  it("shows again the moment the visitor scrolls up, even mid-page", () => {
    expect(nextBarVisibility({ ...base, y: 797, lastY: 800, visible: false })).toBe(true);
    expect(nextBarVisibility({ ...base, y: 600, lastY: 800, visible: false })).toBe(true);
  });

  it("ignores finger jitter in either direction", () => {
    expect(nextBarVisibility({ ...base, y: 803, lastY: 800, visible: true })).toBe(true); // tiny nudge down: stays shown
    expect(nextBarVisibility({ ...base, y: 799, lastY: 800, visible: false })).toBe(false); // tiny nudge up: stays hidden
    expect(nextBarVisibility({ ...base, y: 805, lastY: 800, visible: false })).toBe(false);
  });

  it("does not treat the rubber-band bounce at the bottom of the page as scrolling up", () => {
    // overscrolled past the end, then springing back
    expect(nextBarVisibility({ ...base, y: 5000, lastY: 5040, visible: false })).toBe(false);
    expect(nextBarVisibility({ ...base, y: 5030, lastY: 5000, visible: false })).toBe(false);
    // a real scroll up from the bottom still reveals it
    expect(nextBarVisibility({ ...base, y: 4950, lastY: 5000, visible: false })).toBe(true);
  });

  it("keeps its current state when nothing meaningful moved", () => {
    expect(nextBarVisibility({ ...base, y: 800, lastY: 800, visible: true })).toBe(true);
    expect(nextBarVisibility({ ...base, y: 800, lastY: 800, visible: false })).toBe(false);
  });
});
