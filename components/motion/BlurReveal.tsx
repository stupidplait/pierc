"use client";

import type { ReactNode } from "react";
import { m, useReducedMotion, type Variants } from "framer-motion";
import {
  ENTRANCE_DURATION,
  ENTRANCE_HIDDEN,
  ENTRANCE_SHOW,
  ENTRANCE_STAGGER,
  ENTRANCE_VIEWPORT,
  REVEAL_EASE,
} from "@/components/motion/entrance";

/**
 * blurRevealVariants — the house "blur-focus" entrance as a reusable variant
 * pair: an element resolves from blurred + slightly small to crisp on the site's
 * expo-out curve. The single source of truth for the blur entrance, shared by
 * the standalone {@link BlurReveal} and by any container that drives its own
 * cascade through `staggerChildren` (e.g. the About TOC rail), so every blur
 * entrance across the page reads identically.
 */
export const blurRevealVariants: Variants = {
  hidden: ENTRANCE_HIDDEN,
  show: {
    ...ENTRANCE_SHOW,
    transition: { duration: ENTRANCE_DURATION, ease: REVEAL_EASE },
  },
};

const MOTION_TAGS = {
  div: m.div,
  span: m.span,
  li: m.li,
} as const;

type Tag = keyof typeof MOTION_TAGS;

/**
 * BlurReveal — a standalone element that plays the house blur-focus entrance.
 * The public-site counterpart to blurReveal() (which spreads onto an `m.*`
 * element inside the admin's LazyMotion tree): it uses the lightweight `m`,
 * picks its own trigger, and honours reduced motion.
 *
 *   - `trigger="mount"`   plays once on mount — for above-the-fold hero pieces.
 *   - `trigger="in-view"` plays once when scrolled into view — for lower content.
 *   - `index` cascades a group: each item's start is offset by index × the house
 *     stagger, capped so a long list doesn't trail off (mirrors blurReveal()).
 *   - `delay` offsets the whole element — layer it after a sibling reveal.
 *   - Under `prefers-reduced-motion` the element renders statically.
 *
 * The brand mark is an SVG, so it is wrapped in (not applied to) this motion div
 * — animating the wrapper rather than the SVG node keeps the filter cheap.
 */
export function BlurReveal({
  children,
  as = "div",
  className,
  trigger = "in-view",
  index = 0,
  delay = 0,
  amount = ENTRANCE_VIEWPORT.amount,
}: {
  children?: ReactNode;
  as?: Tag;
  className?: string;
  trigger?: "mount" | "in-view";
  index?: number;
  delay?: number;
  amount?: number;
}) {
  const reduce = useReducedMotion();
  const MotionTag = MOTION_TAGS[as] as typeof m.div;

  if (reduce) {
    return <MotionTag className={className}>{children}</MotionTag>;
  }

  // Target object (not a variant) so the per-instance delay actually applies —
  // a transition baked into a variant would override the prop form.
  const target = {
    ...ENTRANCE_SHOW,
    transition: {
      duration: ENTRANCE_DURATION,
      ease: REVEAL_EASE,
      delay: delay + Math.min(index, 10) * ENTRANCE_STAGGER,
    },
  };
  const trigger_ =
    trigger === "mount"
      ? { animate: target }
      : { whileInView: target, viewport: { once: true, amount } };

  return (
    <MotionTag className={className} initial={ENTRANCE_HIDDEN} {...trigger_}>
      {children}
    </MotionTag>
  );
}
