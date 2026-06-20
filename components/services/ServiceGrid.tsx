"use client";

import { m, useReducedMotion } from "framer-motion";
import { ServiceCard } from "./ServiceCard";
import { blurRevealVariants } from "@/components/motion/BlurReveal";
import {
  ENTRANCE_STAGGER,
  ENTRANCE_VIEWPORT,
} from "@/components/motion/entrance";
import type { BookingUser, WizardService } from "@/lib/booking/wizard-types";

interface ServiceGridProps {
  services: WizardService[];
  user: BookingUser | null;
  bookLabel: string;
  className?: string;
}

/**
 * The services card grid. Each card plays the house blur-focus entrance via the
 * shared {@link blurRevealVariants}, staggered across the grid as it scrolls into
 * view — the same container-stagger pattern as the /about reviews + values grids,
 * so the public pages share one motion vocabulary instead of a bespoke one.
 * Renders statically under prefers-reduced-motion.
 */
export function ServiceGrid({
  services,
  user,
  bookLabel,
  className,
}: ServiceGridProps) {
  const reduce = useReducedMotion();

  if (reduce) {
    return (
      <ul className={className}>
        {services.map((s) => (
          <li key={s.id}>
            <ServiceCard service={s} user={user} bookLabel={bookLabel} />
          </li>
        ))}
      </ul>
    );
  }

  return (
    <m.ul
      className={className}
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
      {services.map((s) => (
        <m.li key={s.id} variants={blurRevealVariants}>
          <ServiceCard service={s} user={user} bookLabel={bookLabel} />
        </m.li>
      ))}
    </m.ul>
  );
}
