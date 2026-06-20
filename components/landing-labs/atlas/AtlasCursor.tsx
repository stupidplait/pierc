"use client";

import { useEffect, useRef } from "react";
import { useReducedMotion } from "framer-motion";
import styles from "./atlas.module.css";

/**
 * AtlasCursor — a thin crosshair "instrument" cursor for the clinical register.
 * Pointer position is written straight to the element transform on pointermove
 * (no React state in the hot path, per the strict react-hooks lint), and the
 * ring tightens over interactive targets. Hidden on coarse pointers + reduced
 * motion (the CSS also restores the native cursor there).
 */
export function AtlasCursor() {
  const ref = useRef<HTMLDivElement | null>(null);
  const reduced = useReducedMotion();

  useEffect(() => {
    if (reduced) return;
    if (typeof window === "undefined") return;
    if (window.matchMedia("(hover: none), (pointer: coarse)").matches) return;

    const el = ref.current;
    if (!el) return;

    let raf = 0;
    let x = window.innerWidth / 2;
    let y = window.innerHeight / 2;
    let visible = false;

    const apply = () => {
      raf = 0;
      el.style.transform = `translate3d(${x}px, ${y}px, 0)`;
    };
    const onMove = (e: PointerEvent) => {
      x = e.clientX;
      y = e.clientY;
      if (!visible) {
        visible = true;
        el.style.opacity = "1";
      }
      // Tighten the ring when over a link/button/hotspot.
      const target = e.target as Element | null;
      const hot = !!target?.closest(
        "a, button, [role='button'], input, label",
      );
      el.classList.toggle(styles.cursorHot, hot);
      if (!raf) raf = requestAnimationFrame(apply);
    };
    const onLeave = () => {
      visible = false;
      el.style.opacity = "0";
    };

    window.addEventListener("pointermove", onMove, { passive: true });
    document.addEventListener("pointerleave", onLeave);
    return () => {
      window.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerleave", onLeave);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [reduced]);

  if (reduced) return null;

  return (
    <div ref={ref} className={styles.cursor} style={{ opacity: 0 }} aria-hidden="true">
      <span className={styles.cursorRing} />
    </div>
  );
}
