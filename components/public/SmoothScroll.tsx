"use client";

import { useEffect } from "react";
import Lenis from "lenis";

type WithLenis = Window & { __lenis?: Lenis };

/**
 * SmoothScroll — buttery momentum (wheel) scrolling for the public site via
 * Lenis. Mounted in the (public) layout, so it covers every public page but
 * NOT the landing (which lives at the app root, outside this layout, and runs
 * its own scroll choreography) or the admin area.
 *
 * Lenis drives real window scroll, so sticky elements, the header's
 * hide-on-scroll bus, and any framer `useScroll` keep working. The instance is
 * published on `window.__lenis` so the shared `scrollToSection` helper can
 * animate in-page jumps through Lenis too.
 *
 * Honours `prefers-reduced-motion`: skips Lenis entirely, leaving native scroll.
 */
export function SmoothScroll() {
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const lenis = new Lenis({ duration: 1.05, autoRaf: true });
    (window as WithLenis).__lenis = lenis;

    return () => {
      lenis.destroy();
      const w = window as WithLenis;
      if (w.__lenis === lenis) delete w.__lenis;
    };
  }, []);

  return null;
}
