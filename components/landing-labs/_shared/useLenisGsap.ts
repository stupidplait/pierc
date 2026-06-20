"use client";

import { useEffect, useRef } from "react";
import Lenis from "lenis";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

/**
 * useLenisGsap — wires Lenis momentum scrolling to GSAP's ScrollTrigger so
 * pinned timelines stay in lockstep with smooth scroll. Call once near the root
 * of a variant's client experience.
 *
 *   const lenis = useLenisGsap();   // lenis.current may be read after mount
 *
 * Behaviour:
 *   • Registers the ScrollTrigger plugin (idempotent).
 *   • Drives lenis.raf from gsap.ticker (single rAF loop, no double-driving).
 *   • Disables gsap lag smoothing so ScrollTrigger scrubbing tracks 1:1.
 *   • Honours prefers-reduced-motion → skips Lenis entirely, leaving native
 *     scroll (ScrollTrigger still works against the native scroller).
 *   • Cleans up fully on unmount (ticker callback, lenis instance, triggers).
 *
 * NOTE: after the variant's images / fonts / canvas settle, call
 * `ScrollTrigger.refresh()` so pin positions recompute against final layout.
 */
export function useLenisGsap(enabled = true) {
  const lenisRef = useRef<Lenis | null>(null);

  useEffect(() => {
    if (!enabled) return;

    gsap.registerPlugin(ScrollTrigger);

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      // Still let ScrollTrigger run against native scroll; just no Lenis.
      ScrollTrigger.refresh();
      return () => {
        ScrollTrigger.getAll().forEach((t) => t.kill());
      };
    }

    const lenis = new Lenis({ duration: 1.05 });
    lenisRef.current = lenis;

    lenis.on("scroll", ScrollTrigger.update);

    const ticker = (time: number) => {
      lenis.raf(time * 1000);
    };
    gsap.ticker.add(ticker);
    gsap.ticker.lagSmoothing(0);

    return () => {
      gsap.ticker.remove(ticker);
      lenis.destroy();
      lenisRef.current = null;
      ScrollTrigger.getAll().forEach((t) => t.kill());
    };
  }, [enabled]);

  return lenisRef;
}
