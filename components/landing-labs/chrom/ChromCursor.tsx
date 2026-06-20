"use client";

import { useEffect, useRef } from "react";
import styles from "./chrom.module.css";

/**
 * Custom chrome cursor — a difference-blended ring that lags the dot, and
 * grows over interactive elements. All transient values live in refs and
 * are written inside a single rAF loop (no setState during render / effect),
 * keeping the strict react-hooks lint happy. Pointer-fine only.
 */
export function ChromCursor() {
  const ringRef = useRef<HTMLDivElement>(null);
  const dotRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fine = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
    if (!fine) return;

    const target = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
    const ring = { x: target.x, y: target.y };
    let raf = 0;
    let hovering = false;

    const onMove = (e: PointerEvent) => {
      target.x = e.clientX;
      target.y = e.clientY;
      const el = e.target as HTMLElement | null;
      hovering = !!el?.closest("a, button, [data-cursor-grow]");
    };

    const loop = () => {
      ring.x += (target.x - ring.x) * 0.18;
      ring.y += (target.y - ring.y) * 0.18;
      if (dotRef.current) {
        dotRef.current.style.transform = `translate3d(${target.x}px, ${target.y}px, 0)`;
      }
      if (ringRef.current) {
        const s = hovering ? 1.7 : 1;
        ringRef.current.style.transform = `translate3d(${ring.x}px, ${ring.y}px, 0) scale(${s})`;
        ringRef.current.style.opacity = hovering ? "0.9" : "0.6";
      }
      raf = requestAnimationFrame(loop);
    };

    window.addEventListener("pointermove", onMove, { passive: true });
    raf = requestAnimationFrame(loop);
    return () => {
      window.removeEventListener("pointermove", onMove);
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <div className={styles.cursor} aria-hidden="true">
      <div ref={ringRef} className={styles.cursorRing} />
      <div ref={dotRef} className={styles.cursorDot} />
    </div>
  );
}
