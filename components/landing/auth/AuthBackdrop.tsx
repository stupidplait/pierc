import type { CSSProperties } from "react";
import { AuthGridBackdrop } from "./AuthGridBackdrop";

/**
 * AuthBackdrop — pure DOM/CSS auth-page backdrop.
 *
 * Renders the flat 2D grid (with radial vignette) + a scattered field of small
 * dots that float gently in place on pure CSS animations (transform only, so
 * they composite on the GPU). One dot is the magenta accent — the single colour
 * moment, matching the rest of the brand. No WebGL, no canvas, no Three.js.
 * `prefers-reduced-motion` halts the float via the global rule in
 * `app/globals.css`.
 *
 * Sits at z-0 (under the form card at z-10) — the card's lighter backdrop-blur
 * lets the floating dots read softly through the glass.
 */
export function AuthBackdrop() {
  return (
    <>
      <AuthGridBackdrop />

      <style>{authDotStyles}</style>

      <div
        className="pointer-events-none fixed inset-0 z-0 overflow-hidden"
        aria-hidden
      >
        {DOTS.map((dot, i) => (
          <span
            key={i}
            className="auth-dot"
            style={
              {
                top: dot.top,
                left: dot.left,
                width: `${dot.size}px`,
                height: `${dot.size}px`,
                opacity: dot.opacity,
                animationDuration: dot.duration,
                animationDelay: dot.delay,
                "--fx": dot.fx,
                "--fy": dot.fy,
                ...(dot.accent ? { background: "var(--accent)" } : null),
              } as CSSProperties
            }
          />
        ))}
      </div>
    </>
  );
}

interface FloatDot {
  top: string;
  left: string;
  size: number;
  opacity: number;
  duration: string;
  delay: string;
  fx: string; // horizontal float amplitude
  fy: string; // vertical float amplitude
  accent?: boolean;
}

// Scattered field. Negative delays start each dot mid-float so nothing snaps
// into motion on first paint. Float amplitudes (fx/fy) vary in direction so the
// field reads as organic drift rather than a synchronized bob.
const DOTS: FloatDot[] = [
  { top: "8%", left: "12%", size: 2, opacity: 0.5, duration: "9s", delay: "-1s", fx: "10px", fy: "-18px" },
  { top: "6%", left: "47%", size: 1, opacity: 0.35, duration: "11s", delay: "-5s", fx: "-12px", fy: "-14px" },
  { top: "11%", left: "78%", size: 3, opacity: 0.45, duration: "8s", delay: "-3s", fx: "14px", fy: "-12px", accent: true },
  { top: "9%", left: "92%", size: 1, opacity: 0.3, duration: "12s", delay: "-7s", fx: "-8px", fy: "-20px" },
  { top: "19%", left: "27%", size: 2, opacity: 0.4, duration: "10s", delay: "-2s", fx: "-14px", fy: "-10px" },
  { top: "22%", left: "62%", size: 1, opacity: 0.3, duration: "13s", delay: "-8s", fx: "12px", fy: "-16px" },
  { top: "24%", left: "88%", size: 2, opacity: 0.4, duration: "9s", delay: "-4s", fx: "-10px", fy: "-22px" },
  { top: "31%", left: "8%", size: 1, opacity: 0.35, duration: "11s", delay: "-6s", fx: "12px", fy: "-12px" },
  { top: "34%", left: "41%", size: 2, opacity: 0.4, duration: "8s", delay: "-1s", fx: "-12px", fy: "-18px" },
  { top: "37%", left: "71%", size: 1, opacity: 0.3, duration: "12s", delay: "-9s", fx: "14px", fy: "-10px" },
  { top: "39%", left: "95%", size: 2, opacity: 0.35, duration: "10s", delay: "-3s", fx: "-8px", fy: "-16px" },
  { top: "46%", left: "18%", size: 1, opacity: 0.3, duration: "13s", delay: "-5s", fx: "10px", fy: "-20px" },
  { top: "49%", left: "55%", size: 2, opacity: 0.4, duration: "9s", delay: "-7s", fx: "-14px", fy: "-12px" },
  { top: "52%", left: "84%", size: 1, opacity: 0.3, duration: "11s", delay: "-2s", fx: "12px", fy: "-14px" },
  { top: "58%", left: "5%", size: 2, opacity: 0.4, duration: "8s", delay: "-6s", fx: "-10px", fy: "-18px" },
  { top: "61%", left: "33%", size: 1, opacity: 0.3, duration: "12s", delay: "-4s", fx: "12px", fy: "-10px" },
  { top: "64%", left: "67%", size: 3, opacity: 0.4, duration: "10s", delay: "-8s", fx: "-12px", fy: "-16px" },
  { top: "66%", left: "91%", size: 1, opacity: 0.3, duration: "13s", delay: "-1s", fx: "8px", fy: "-22px" },
  { top: "72%", left: "22%", size: 2, opacity: 0.4, duration: "9s", delay: "-3s", fx: "-12px", fy: "-12px" },
  { top: "75%", left: "49%", size: 1, opacity: 0.3, duration: "11s", delay: "-9s", fx: "14px", fy: "-18px" },
  { top: "78%", left: "79%", size: 2, opacity: 0.35, duration: "8s", delay: "-5s", fx: "-10px", fy: "-14px" },
  { top: "84%", left: "10%", size: 1, opacity: 0.3, duration: "12s", delay: "-2s", fx: "12px", fy: "-16px" },
  { top: "86%", left: "44%", size: 2, opacity: 0.4, duration: "10s", delay: "-7s", fx: "-14px", fy: "-10px" },
  { top: "88%", left: "73%", size: 1, opacity: 0.3, duration: "13s", delay: "-4s", fx: "10px", fy: "-20px" },
  { top: "92%", left: "29%", size: 2, opacity: 0.35, duration: "9s", delay: "-6s", fx: "-8px", fy: "-12px" },
  { top: "94%", left: "60%", size: 1, opacity: 0.3, duration: "11s", delay: "-1s", fx: "12px", fy: "-18px" },
  { top: "15%", left: "5%", size: 1, opacity: 0.3, duration: "10s", delay: "-8s", fx: "10px", fy: "-14px" },
  { top: "55%", left: "38%", size: 1, opacity: 0.3, duration: "12s", delay: "-3s", fx: "-12px", fy: "-16px" },
];

const authDotStyles = `
.auth-dot {
  position: absolute;
  border-radius: 9999px;
  background: rgba(239, 231, 216, 0.6);
  will-change: transform;
  animation-name: authDotFloat;
  animation-timing-function: ease-in-out;
  animation-iteration-count: infinite;
  animation-direction: alternate;
}

@keyframes authDotFloat {
  from { transform: translate3d(0, 0, 0); }
  to   { transform: translate3d(var(--fx, 0px), var(--fy, -18px), 0); }
}
`;
