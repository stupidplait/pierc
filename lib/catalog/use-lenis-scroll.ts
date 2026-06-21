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

    // Lenis caches its scroll limit (scrollHeight − height). Here wrapper ===
    // content === the fixed-height overflow container, whose OWN box never
    // changes when the inner list grows or shrinks — so Lenis' content
    // ResizeObserver (which watches that box) never fires on a content change.
    // Switching the focused anchor swaps the list of pieces *inside* the
    // container, so without a nudge Lenis keeps the previous, shorter limit and
    // clamps scrolling part-way down a longer list (the reported "can only
    // scroll a little" bug). Re-sync the limit whenever the inner content
    // actually changes size — a list swap, an async image, a panel resize. One
    // rAF coalesces a burst of mutations into a single resize.
    let raf = 0;
    const resync = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        lenis.resize();
      });
    };

    // The container's box is static; its children are what grow, so observe
    // them. Re-observe after a childList change (e.g. the empty-state <p>
    // swapping in for the grid <div>, which would otherwise go unobserved).
    const ro = new ResizeObserver(resync);
    const observeContent = () => {
      for (const child of Array.from(el.children)) ro.observe(child);
    };
    observeContent();

    const mo = new MutationObserver(() => {
      observeContent();
      resync();
    });
    mo.observe(el, { childList: true });

    cleanupRef.current = () => {
      if (raf) cancelAnimationFrame(raf);
      ro.disconnect();
      mo.disconnect();
      lenis.destroy();
    };
  }, []);

  useEffect(() => () => cleanupRef.current?.(), []);

  return setRef;
}
