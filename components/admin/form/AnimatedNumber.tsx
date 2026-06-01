"use client";

import { useEffect } from "react";
import {
  motion,
  useMotionValue,
  useSpring,
  useTransform,
  useReducedMotion,
} from "framer-motion";

/**
 * A number that springs from its previous value to the new one when `value`
 * changes — the smooth motion.dev "AnimatedNumber" pattern: a spring-driven
 * MotionValue rendered straight into a `motion.span` (no React state, so it
 * never trips the project's set-state-in-effect lint). Reduced-motion snaps.
 *
 * `format` maps the live (rounded) value to the displayed string — pass it to
 * keep currency/grouping (e.g. `formatPrice`) or zero-padding (`pad`) while
 * still animating the digits; it defaults to a bare integer. `countOnMount`
 * springs up from 0 on first paint (a dashboard-stat entrance) instead of
 * starting at `value`; later `value` changes always spring regardless.
 */
export function AnimatedNumber({
  value,
  className,
  format = (n) => n.toString(),
  countOnMount = false,
}: {
  value: number;
  className?: string;
  format?: (n: number) => string;
  countOnMount?: boolean;
}) {
  const reduce = useReducedMotion();
  // Start at 0 for the mount count-up. The initial value must NOT depend on
  // `reduce` (null on the server, real on the client → hydration mismatch);
  // `reduce` instead routes the text through `source` below, so reduced-motion
  // users snap 0→value in a single frame instead of springing.
  const source = useMotionValue(countOnMount ? 0 : value);
  const spring = useSpring(source, { stiffness: 90, damping: 18, mass: 0.6 });
  const text = useTransform(reduce ? source : spring, (v) =>
    format(Math.round(v)),
  );

  useEffect(() => {
    source.set(value);
  }, [value, source]);

  return <motion.span className={className}>{text}</motion.span>;
}
