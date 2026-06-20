"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import styles from "./director.module.css";

/**
 * DirectorPreloader — a film-slate intro: a counter ratchets 0 → 100 while the
 * PIERCERKZN wordmark draws itself in, then a clapperboard "snaps" and the
 * letterbox cut begins. Counting is driven by a rAF loop writing to a ref +
 * DOM (no setState-per-frame, no Date.now() in render). The component only
 * setStates on discrete lifecycle beats (skip-enable, dismiss).
 *
 * `ready` flips true once the WebGL scene reports its first frame. The slate
 * holds for a tasteful minimum, then dismisses; clicking after the grace skips.
 */

const MIN_MS = 2600;
const GRACE_MS = 700;
const OUT_MS = 700;

function useReducedMotion(): boolean {
  return useSyncExternalStore(
    (cb) => {
      const mql = window.matchMedia("(prefers-reduced-motion: reduce)");
      mql.addEventListener("change", cb);
      return () => mql.removeEventListener("change", cb);
    },
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    () => false,
  );
}

export function DirectorPreloader({
  ready,
  onDismissStart,
}: {
  ready: boolean;
  onDismissStart: () => void;
}) {
  const reduced = useReducedMotion();
  const [minPassed, setMinPassed] = useState(false);
  const [canSkip, setCanSkip] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  const counterRef = useRef<HTMLSpanElement>(null);
  const startRef = useRef(0);
  const dismissFired = useRef(false);

  // Minimum-display + skip-grace timers (discrete beats — fine as effects).
  useEffect(() => {
    const a = setTimeout(() => setMinPassed(true), reduced ? 600 : MIN_MS);
    const b = setTimeout(() => setCanSkip(true), GRACE_MS);
    return () => {
      clearTimeout(a);
      clearTimeout(b);
    };
  }, [reduced]);

  // rAF counter: eases 0 → ~96 over the min window; snaps to 100 when allowed.
  useEffect(() => {
    let raf = 0;
    const tick = (now: number) => {
      if (startRef.current === 0) startRef.current = now;
      const el = counterRef.current;
      if (el) {
        const elapsed = now - startRef.current;
        const p = Math.min(1, elapsed / (reduced ? 600 : MIN_MS));
        // easeOutCubic, capped at 96 until the real dismiss snaps it to 100
        const eased = 1 - Math.pow(1 - p, 3);
        const val = Math.min(96, Math.round(eased * 96));
        el.textContent = String(val).padStart(3, "0");
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [reduced]);

  const shouldHide = ready && minPassed;

  // Snap the counter to 100 + fire the cut once, then unmount after the fade.
  useEffect(() => {
    if (!shouldHide || dismissFired.current) return;
    dismissFired.current = true;
    if (counterRef.current) counterRef.current.textContent = "100";
    onDismissStart();
    const id = setTimeout(() => setDismissed(true), OUT_MS);
    return () => clearTimeout(id);
  }, [shouldHide, onDismissStart]);

  if (dismissed) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      onClick={() => canSkip && setMinPassed(true)}
      className={`${styles.preloader} ${shouldHide ? styles.preloaderOut : ""}`}
      data-can-skip={canSkip ? "1" : "0"}
      style={{ cursor: canSkip ? "pointer" : "default" }}
    >
      <span className="sr-only">{shouldHide ? "Загрузка завершена" : "Загрузка"}</span>

      {/* slate corners */}
      <span aria-hidden className={styles.slateCorner} style={{ top: 36, left: 36, borderTop: "1px solid", borderLeft: "1px solid" }} />
      <span aria-hidden className={styles.slateCorner} style={{ top: 36, right: 36, borderTop: "1px solid", borderRight: "1px solid" }} />
      <span aria-hidden className={styles.slateCorner} style={{ bottom: 36, left: 36, borderBottom: "1px solid", borderLeft: "1px solid" }} />
      <span aria-hidden className={styles.slateCorner} style={{ bottom: 36, right: 36, borderBottom: "1px solid", borderRight: "1px solid" }} />

      {/* clapper sticks */}
      <div aria-hidden className={styles.clap}>
        {Array.from({ length: 12 }).map((_, i) => (
          <span
            key={i}
            className={styles.clapStick}
            style={{ background: i % 2 === 0 ? "#f4f4f4" : "#0a0a0a" }}
          />
        ))}
      </div>

      {/* draw-in wordmark */}
      <svg
        viewBox="0 0 2000 240"
        preserveAspectRatio="xMidYMid meet"
        className="block h-auto w-[min(90vw,1100px)]"
        aria-hidden
      >
        <text
          x="1000"
          y="180"
          textAnchor="middle"
          fontFamily="var(--font-director-display), var(--font-onest), sans-serif"
          fontSize="200"
          fontWeight={700}
          letterSpacing="6"
          fill="none"
          stroke="#f4f4f4"
          strokeOpacity={0.14}
          strokeWidth="1.4"
        >
          PIERCERKZN
        </text>
        <text
          x="1000"
          y="180"
          textAnchor="middle"
          fontFamily="var(--font-director-display), var(--font-onest), sans-serif"
          fontSize="200"
          fontWeight={700}
          letterSpacing="6"
          fill="none"
          stroke="#f4f4f4"
          strokeWidth="1.4"
          className={styles.draw}
        />
      </svg>

      {/* slate metadata + counter */}
      <div className="flex w-[min(90vw,1100px)] items-end justify-between font-mono text-[10px] uppercase tracking-[0.26em] text-white/55">
        <span>СЦЕНА 05 · ДУБЛЬ 01</span>
        <span className="text-white/80">
          <span ref={counterRef}>000</span>
          <span className="text-white/40"> / 100</span>
        </span>
        <span className="hidden sm:inline">PIERCERKZN · КАЗАНЬ</span>
      </div>

      {canSkip && (
        <span className="font-mono text-[9px] uppercase tracking-[0.3em] text-white/35">
          нажмите, чтобы пропустить
        </span>
      )}
    </div>
  );
}
