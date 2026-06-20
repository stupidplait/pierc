"use client";

import { useEffect, useRef } from "react";
import styles from "./ostrie.module.css";

/**
 * Cursor — custom two-part cursor for «ОСТРИЁ»: a small accent dot that tracks
 * the pointer 1:1 and a hairline ring that lags behind (spring-eased), giving the
 * editorial page a tactile, designed feel. The ring grows + the dot hides when
 * hovering anything tagged data-cursor="magnet" (links/buttons), which also
 * applies a subtle magnetic pull toward the target's centre.
 *
 * All transient values live in refs and are written inside a single rAF loop —
 * never via setState in an effect — to satisfy the strict react-hooks lint and
 * keep the cursor off the React render path. Hidden on touch / reduced-motion via
 * the CSS module.
 */
export function Cursor() {
  const dotRef = useRef<HTMLDivElement>(null);
  const ringRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fine = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
    const reduce = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    if (!fine || reduce) return;

    const dot = dotRef.current;
    const ring = ringRef.current;
    if (!dot || !ring) return;

    // Target (raw pointer) + smoothed ring position, both in refs.
    const target = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
    const ringPos = { ...target };
    let scale = 1;
    let scaleTarget = 1;
    let raf = 0;

    const onMove = (e: PointerEvent) => {
      target.x = e.clientX;
      target.y = e.clientY;
      // Magnetic pull: if over a magnet element, ease the dot toward its centre.
      const el = (e.target as HTMLElement | null)?.closest?.(
        "[data-cursor='magnet']",
      ) as HTMLElement | null;
      scaleTarget = el ? 1.9 : 1;
      if (el) {
        const r = el.getBoundingClientRect();
        const cx = r.left + r.width / 2;
        const cy = r.top + r.height / 2;
        target.x = e.clientX + (cx - e.clientX) * 0.28;
        target.y = e.clientY + (cy - e.clientY) * 0.28;
      }
    };

    const tick = () => {
      ringPos.x += (target.x - ringPos.x) * 0.18;
      ringPos.y += (target.y - ringPos.y) * 0.18;
      scale += (scaleTarget - scale) * 0.18;
      dot.style.transform = `translate3d(${target.x}px, ${target.y}px, 0) scale(${scaleTarget > 1 ? 0 : 1})`;
      ring.style.transform = `translate3d(${ringPos.x}px, ${ringPos.y}px, 0) scale(${scale})`;
      raf = requestAnimationFrame(tick);
    };

    window.addEventListener("pointermove", onMove, { passive: true });
    raf = requestAnimationFrame(tick);

    return () => {
      window.removeEventListener("pointermove", onMove);
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <>
      <div ref={ringRef} className={styles.cursorRing} aria-hidden="true" />
      <div ref={dotRef} className={styles.cursor} aria-hidden="true" />
    </>
  );
}
