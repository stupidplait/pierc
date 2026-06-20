"use client";

import { m, useReducedMotion } from "framer-motion";
import {
  ENTRANCE_STAGGER,
  ENTRANCE_VIEWPORT,
} from "@/components/motion/entrance";
import { blurRevealVariants } from "@/components/motion/BlurReveal";
import {
  TestimonialCard,
  type TestimonialCardData,
} from "@/components/public/TestimonialCard";

/**
 * AboutReviews — the featured-testimonials grid on /about. Each card plays the
 * house blur-focus entrance ({@link blurRevealVariants}), staggered across the
 * grid as it scrolls into view — the same choreography as the ValuesRail cards
 * higher up the page, so the two grids read as one family. Under reduced motion
 * the grid renders statically.
 */
export function AboutReviews({
  testimonials,
}: {
  testimonials: TestimonialCardData[];
}) {
  const reduce = useReducedMotion();

  if (reduce) {
    return (
      <ul className="grid gap-4 sm:grid-cols-2">
        {testimonials.map((r) => (
          <li key={r.id} className="h-full">
            <TestimonialCard review={r} />
          </li>
        ))}
      </ul>
    );
  }

  return (
    <m.ul
      className="grid gap-4 sm:grid-cols-2"
      initial="hidden"
      whileInView="show"
      viewport={ENTRANCE_VIEWPORT}
      variants={{
        hidden: {},
        show: {
          transition: {
            staggerChildren: ENTRANCE_STAGGER,
            delayChildren: 0.05,
          },
        },
      }}
    >
      {testimonials.map((r) => (
        <m.li key={r.id} className="h-full" variants={blurRevealVariants}>
          <TestimonialCard review={r} />
        </m.li>
      ))}
    </m.ul>
  );
}
