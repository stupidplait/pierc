"use client";

import { useEffect } from "react";
// Uses LazyMotion `m`: the app-wide MotionProvider (app/layout.tsx) supplies the
// feature set, so this animates even when rendered far from any local LazyMotion
// island (e.g. the jewelry PhotoDropzone).
import {
  m,
  useMotionValue,
  useSpring,
  useTransform,
  type MotionValue,
} from "framer-motion";

/**
 * Animated integer — springs from the previous value to the next instead of
 * snapping, so a changing count (e.g. "Загрузить 3 файла") rolls smoothly. The
 * displayed value is always rounded; the spring runs on a hidden MotionValue.
 * Honours reduced-motion via the ambient MotionConfig (a stiff spring settles
 * fast, and reduced-motion makes it effectively instant).
 *
 * Pass `from` to also roll on FIRST mount: the spring seeds there and the mount
 * effect immediately retargets it to `value`, giving an entrance count-up. Omit
 * `from` (the default) to mount already settled at `value` and only animate on
 * later changes. Server render + first client paint both show `from`, so there's
 * no hydration mismatch.
 */
export function AnimateNumber({
  value,
  from,
  className,
}: {
  value: number;
  from?: number;
  className?: string;
}) {
  const motionValue: MotionValue<number> = useMotionValue(from ?? value);
  const spring = useSpring(motionValue, { stiffness: 300, damping: 30 });
  const rounded = useTransform(spring, (v) => Math.round(v).toString());

  useEffect(() => {
    motionValue.set(value);
  }, [motionValue, value]);

  return (
    <m.span className={className} aria-hidden>
      {rounded}
    </m.span>
  );
}
