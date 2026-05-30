"use client";

import { motion, useReducedMotion } from "framer-motion";
import { Card } from "@/components/ui/Card";
import {
  ENTRANCE_DURATION,
  ENTRANCE_HIDDEN,
  ENTRANCE_SHOW,
  ENTRANCE_STAGGER,
  ENTRANCE_VIEWPORT,
  REVEAL_EASE,
} from "@/components/services/entrance/config";

/**
 * ValuesRail — the three studio principles as discrete card surfaces, matching
 * the shared card vocabulary used across the app (rounded surface, hairline
 * border, `bg-card`). Each card keeps its mono index (01 / 02 / 03) as a quiet
 * dossier marker above the title; `h-full` lets the row's cards share a height.
 *
 * Entry choreography mirrors the /services grid (StaggerGrid): the same
 * blur-focus entrance — from blurred + slightly small to crisp — staggered
 * across the cards, and disabled under reduced-motion. The viewport trigger is
 * the shared ENTRANCE_VIEWPORT (a low amount), so the stagger fires as soon as
 * the grid edges into view rather than after the user has scrolled past it.
 */
export function ValuesRail({
  items,
}: {
  items: ReadonlyArray<{ title: string; body: string }>;
}) {
  const reduce = useReducedMotion();

  return (
    <motion.ol
      className="grid gap-4 sm:grid-cols-3"
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
      {items.map((v, i) => (
        <motion.li
          key={v.title}
          className="h-full"
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
          <Card className="flex h-full flex-col">
            <span className="font-mono text-sm text-mute">
              {String(i + 1).padStart(2, "0")}
            </span>
            <h3 className="mt-4 font-display text-xl font-medium text-ink">
              {v.title}
            </h3>
            <p className="mt-2 text-mute">{v.body}</p>
          </Card>
        </motion.li>
      ))}
    </motion.ol>
  );
}
