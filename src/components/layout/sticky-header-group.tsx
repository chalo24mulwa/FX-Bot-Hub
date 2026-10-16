"use client";

import { useEffect, useRef, useState } from "react";
import { nextBarVisibility } from "@/lib/scroll-direction";

const PHONE = "(max-width: 767.98px)";

/**
 * Wraps the phone quick-links bar and the header row. On phones the pair is one sticky unit pinned to the top; the bar slides up
 * out of view when the visitor scrolls down and slides back the instant they scroll up (and stays shown at the top of the page,
 * while the menu is open, and when something in it receives keyboard focus). It moves with a transform, so the unit keeps its
 * full height in the layout: nothing jumps, nothing reflows, and the page content never sits under it.
 *
 * From `md` up this wrapper is `display: contents`, so tablets and desktops lay out exactly as they did before it existed.
 * One passive scroll listener, throttled to one read per animation frame, and only attached while the screen is phone-sized.
 */
export function StickyHeaderGroup({ children, forceVisible = false }: { children: React.ReactNode; forceVisible?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const [hidden, setHidden] = useState(false);
  const visibleRef = useRef(true);
  const forceRef = useRef(forceVisible);

  useEffect(() => {
    forceRef.current = forceVisible;
    if (forceVisible && !visibleRef.current) {
      visibleRef.current = true;
      setHidden(false);
    }
  }, [forceVisible]);

  useEffect(() => {
    const media = window.matchMedia(PHONE);
    let lastY = window.scrollY;
    let frame = 0;
    let attached = false;

    const measure = () => {
      const bar = ref.current?.querySelector<HTMLElement>("[data-utility-bar]");
      const height = bar ? bar.getBoundingClientRect().height : 0;
      ref.current?.style.setProperty("--utility-bar-height", `${Math.round(height)}px`);
      return height;
    };

    const update = () => {
      frame = 0;
      const y = window.scrollY;
      const maxY = document.documentElement.scrollHeight - window.innerHeight;
      const next = forceRef.current ? true : nextBarVisibility({ y, lastY, visible: visibleRef.current, barHeight: measure(), maxY });
      lastY = y;
      if (next !== visibleRef.current) {
        visibleRef.current = next;
        setHidden(!next);
      }
    };

    const onScroll = () => {
      if (!frame) frame = window.requestAnimationFrame(update);
    };

    const sync = () => {
      if (media.matches && !attached) {
        measure();
        lastY = window.scrollY;
        window.addEventListener("scroll", onScroll, { passive: true });
        window.addEventListener("resize", measure);
        attached = true;
      } else if (!media.matches && attached) {
        window.removeEventListener("scroll", onScroll);
        window.removeEventListener("resize", measure);
        attached = false;
        visibleRef.current = true;
        setHidden(false);
      }
    };

    sync();
    media.addEventListener("change", sync);
    // Marks the moment the scroll handling is live (hydrated and listening); tests wait for it before scrolling.
    ref.current?.setAttribute("data-ready", "1");
    return () => {
      media.removeEventListener("change", sync);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", measure);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <div
      ref={ref}
      data-utility-hidden={hidden ? "true" : "false"}
      // Keyboard users tabbing into the bar while it is tucked away bring it back.
      onFocusCapture={() => {
        if (!visibleRef.current) {
          visibleRef.current = true;
          setHidden(false);
        }
      }}
      className="utility-sticky-group max-md:sticky max-md:top-0 max-md:z-40 md:contents"
    >
      {children}
    </div>
  );
}
