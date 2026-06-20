"use client";

import { useRef } from "react";
import Link from "next/link";
import { useReducedMotion } from "framer-motion";
import styles from "./vitrina.module.css";

/**
 * MagneticButton — a CTA link whose body eases toward the pointer (and whose
 * inner content over-travels slightly) for a tactile magnetic feel. All motion
 * is written to refs / style transforms inside event handlers — never via
 * setState in an effect — so the project's strict react-hooks lint stays happy
 * and there is no per-frame React work.
 *
 * Honours prefers-reduced-motion (no magnetism). Renders a real <Link> so it is
 * keyboard-focusable with a visible focus ring (see .btn:focus-visible).
 */
export function MagneticButton({
  href,
  children,
  variant = "primary",
  strength = 0.3,
}: {
  href: string;
  children: React.ReactNode;
  variant?: "primary" | "ghost";
  strength?: number;
}) {
  const rootRef = useRef<HTMLAnchorElement | null>(null);
  const innerRef = useRef<HTMLSpanElement | null>(null);
  const reduce = useReducedMotion();

  const onMove = (e: React.PointerEvent<HTMLAnchorElement>) => {
    if (reduce) return;
    const el = rootRef.current;
    const inner = innerRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const dx = e.clientX - (r.left + r.width / 2);
    const dy = e.clientY - (r.top + r.height / 2);
    el.style.transform = `translate(${dx * strength}px, ${dy * strength}px)`;
    if (inner) {
      inner.style.transform = `translate(${dx * strength * 0.5}px, ${dy * strength * 0.5}px)`;
    }
  };

  const reset = () => {
    const el = rootRef.current;
    const inner = innerRef.current;
    if (el) el.style.transform = "translate(0px, 0px)";
    if (inner) inner.style.transform = "translate(0px, 0px)";
  };

  return (
    <Link
      ref={rootRef}
      href={href}
      onPointerMove={onMove}
      onPointerLeave={reset}
      onBlur={reset}
      className={`${styles.btn} ${variant === "primary" ? styles.btnPrimary : styles.btnGhost}`}
      data-cursor="link"
    >
      <span ref={innerRef} className={styles.btnInner}>
        {children}
      </span>
    </Link>
  );
}
