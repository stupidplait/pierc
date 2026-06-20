"use client";

import styles from "./chrom.module.css";

/**
 * Branded static fallback rendered when WebGL2 is unavailable. Keeps the
 * chrome wordmark + atmosphere so the page still reads as «ХРОМ», just
 * without the live liquid-metal canvas.
 */
export function ChromFallback() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 flex items-center justify-center"
      style={{
        background:
          "radial-gradient(60% 60% at 50% 35%, color-mix(in oklab, var(--accent) 22%, transparent), transparent 70%), var(--bg)",
      }}
    >
      <div
        className={styles.display}
        style={{
          fontSize: "clamp(60px, 24vw, 320px)",
          color: "transparent",
          WebkitTextStroke: "1px color-mix(in oklab, var(--ink) 35%, transparent)",
          opacity: 0.5,
        }}
      >
        ХРОМ
      </div>
    </div>
  );
}
