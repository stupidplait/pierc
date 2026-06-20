"use client";

import { useEffect, useRef } from "react";
import styles from "./director.module.css";

/**
 * Cursor — a director's-viewfinder reticle that follows the pointer with a
 * little smoothing and grows + tints accent over interactive targets. Driven
 * entirely by rAF + refs (no setState per frame, lint-safe). Only mounts on
 * fine-pointer, hover-capable devices; hidden under reduced-motion.
 */
export function Cursor() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fine = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!fine || reduced) return;

    const el = ref.current;
    if (!el) return;
    el.style.opacity = "1";

    const target = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
    const pos = { ...target };
    let raf = 0;

    const onMove = (e: PointerEvent) => {
      target.x = e.clientX;
      target.y = e.clientY;
      const hot = !!(e.target as HTMLElement)?.closest(
        "a, button, [role='button'], input, label, summary, [data-hot]",
      );
      el.dataset.hot = hot ? "1" : "0";
    };
    const onDown = () => (el.dataset.press = "1");
    const onUp = () => (el.dataset.press = "0");
    const onLeave = () => (el.style.opacity = "0");
    const onEnter = () => (el.style.opacity = "1");

    const loop = () => {
      pos.x += (target.x - pos.x) * 0.28;
      pos.y += (target.y - pos.y) * 0.28;
      const press = el.dataset.press === "1" ? 0.82 : 1;
      el.style.transform = `translate3d(${pos.x}px, ${pos.y}px, 0) scale(${press})`;
      raf = requestAnimationFrame(loop);
    };
    loop();

    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("pointerdown", onDown);
    window.addEventListener("pointerup", onUp);
    document.addEventListener("pointerleave", onLeave);
    document.addEventListener("pointerenter", onEnter);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointerup", onUp);
      document.removeEventListener("pointerleave", onLeave);
      document.removeEventListener("pointerenter", onEnter);
    };
  }, []);

  return (
    <div ref={ref} className={styles.cursor} aria-hidden style={{ opacity: 0 }}>
      <span className={styles.cursorRing} />
      <span className={styles.cursorDot} />
      <span className={`${styles.cursorTick} ${styles.tickT}`} />
      <span className={`${styles.cursorTick} ${styles.tickB}`} />
      <span className={`${styles.cursorTick} ${styles.tickL}`} />
      <span className={`${styles.cursorTick} ${styles.tickR}`} />
    </div>
  );
}
