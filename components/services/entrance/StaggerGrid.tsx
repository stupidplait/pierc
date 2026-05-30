"use client";

import { motion, useReducedMotion } from "framer-motion";
import { ServiceCard } from "../ServiceCard";
import {
  ENTRANCE_DURATION,
  ENTRANCE_HIDDEN,
  ENTRANCE_SHOW,
  ENTRANCE_STAGGER,
  ENTRANCE_VIEWPORT,
  REVEAL_EASE,
} from "./config";
import type { BookingUser, WizardService } from "@/lib/booking/wizard-types";

interface StaggerGridProps {
  services: WizardService[];
  user: BookingUser | null;
  bookLabel: string;
  className?: string;
}

// The card grid, blur-focus revealed when it scrolls into view (once). The
// container offsets each card's start time to stagger them in.
export function StaggerGrid({
  services,
  user,
  bookLabel,
  className,
}: StaggerGridProps) {
  const reduce = useReducedMotion();

  return (
    <motion.ul
      className={className}
      initial="hidden"
      whileInView="show"
      viewport={ENTRANCE_VIEWPORT}
      variants={{
        hidden: {},
        show: {
          transition: {
            staggerChildren: reduce ? 0 : ENTRANCE_STAGGER,
            delayChildren: 0.05,
          },
        },
      }}
    >
      {services.map((s) => (
        <motion.li
          key={s.id}
          variants={{
            hidden: ENTRANCE_HIDDEN,
            show: {
              ...ENTRANCE_SHOW,
              transition: {
                duration: reduce ? 0 : ENTRANCE_DURATION,
                ease: REVEAL_EASE,
              },
            },
          }}
        >
          <ServiceCard service={s} user={user} bookLabel={bookLabel} />
        </motion.li>
      ))}
    </motion.ul>
  );
}
