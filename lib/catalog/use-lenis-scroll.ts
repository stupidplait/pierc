"use client";

import { useCallback, useEffect, useRef } from "react";
import Lenis from "lenis";

/**
 * Buttery momentum scrolling for an inner container — a per-element Lenis
 * instance, the SAME engine the page uses (components/public/SmoothScroll.tsx),
 * so the inventory rail / zone popovers scroll with identical feel instead of
 * the steppy native wheel. Returns a callback ref so it attaches whenever the
 * node mounts (e.g. a popover opening) and tears down on unmount.
 *
 * Pair with `data-lenis-prevent` on the element so the page's global Lenis
 * ignores it and this instance owns the wheel. Honours reduced-motion (no-op).
 */
export function useLenisScroll() {
  const cleanupRef = useRef<(() => void) | null>(null);

  const setRef = useCallback((el: HTMLElement | null) => {
    cleanupRef.current?.();
    cleanupRef.current = null;
    if (!el) return;
    if (
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      return;
    }

    const lenis = new Lenis({
      wrapper: el,
      content: el,
      duration: 0.9,
      smoothWheel: true,
      autoRaf: true,
    });
    cleanupRef.current = () => lenis.destroy();
  }, []);

  useEffect(() => () => cleanupRef.current?.(), []);

  return setRef;
}
