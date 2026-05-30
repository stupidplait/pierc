"use client";

import { motion, useReducedMotion } from "framer-motion";
import type { ReactNode } from "react";
import {
  ENTRANCE_DURATION,
  ENTRANCE_HIDDEN,
  ENTRANCE_SHOW,
  REVEAL_EASE,
} from "./config";

interface BlockRevealProps {
  delay?: number;
  className?: string;
  children: ReactNode;
}

// Blur-focus reveal for a single block (the featured card), played on mount.
// Reduced-motion users get duration 0 — the element renders from the same SSR
// markup and simply settles instantly, so there's no hydration mismatch.
export function BlockReveal({ delay = 0, className, children }: BlockRevealProps) {
  const reduce = useReducedMotion();

  return (
    <motion.div
      className={className}
      initial="hidden"
      animate="show"
      variants={{
        hidden: ENTRANCE_HIDDEN,
        show: {
          ...ENTRANCE_SHOW,
          transition: {
            duration: reduce ? 0 : ENTRANCE_DURATION,
            delay: reduce ? 0 : delay,
            ease: REVEAL_EASE,
          },
        },
      }}
    >
      {children}
    </motion.div>
  );
}
