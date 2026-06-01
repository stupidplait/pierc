"use client";

import { useEffect } from "react";
import {
  motion,
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
 */
export function AnimateNumber({
  value,
  className,
}: {
  value: number;
  className?: string;
}) {
  const motionValue: MotionValue<number> = useMotionValue(value);
  const spring = useSpring(motionValue, { stiffness: 300, damping: 30 });
  const rounded = useTransform(spring, (v) => Math.round(v).toString());

  useEffect(() => {
    motionValue.set(value);
  }, [motionValue, value]);

  return (
    <motion.span className={className} aria-hidden>
      {rounded}
    </motion.span>
  );
}
