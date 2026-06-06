"use client";

import { m, useReducedMotion } from "framer-motion";
import {
  Fingerprint,
  HeartHandshake,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react";
import { Card } from "@/components/shadcn/ui/card";
import {
  ENTRANCE_DURATION,
  ENTRANCE_HIDDEN,
  ENTRANCE_SHOW,
  ENTRANCE_STAGGER,
  ENTRANCE_VIEWPORT,
  REVEAL_EASE,
} from "@/components/services/entrance/config";

type Value = { title: string; body: string };

// One glyph per studio principle, in the copy's order: individual fit →
// sterility → aftercare. Decorative (aria-hidden) — the title and body carry the
// meaning, so a copy change at worst falls back to a sensible default icon.
const PRINCIPLE_ICONS: readonly LucideIcon[] = [
  Fingerprint,
  ShieldCheck,
  HeartHandshake,
];

const idx = (i: number) => String(i + 1).padStart(2, "0");
const iconFor = (i: number): LucideIcon => PRINCIPLE_ICONS[i] ?? Fingerprint;

// Render the glyph through a prop, not a local binding: `<Icon/>` from a
// destructured prop satisfies both react-hooks/static-components and
// react-doctor/no-render-in-render.
const Glyph = ({
  icon: Icon,
  className,
}: {
  icon: LucideIcon;
  className: string;
}) => <Icon className={className} aria-hidden />;

/**
 * ValuesRail — the three studio principles ("Подходы") as cards: each pairs an
 * accent glyph with an oversized, faint dossier index (01 / 02 / 03) set as a
 * watermark in the corner, over the title and body. `h-full` lets the row share
 * a height.
 *
 * Entry choreography mirrors the /services grid: the house blur-focus entrance —
 * from blurred + slightly small to crisp — staggered across the cards on the
 * shared low ENTRANCE_VIEWPORT, and disabled under reduced m.
 */
export function ValuesRail({ items }: { items: ReadonlyArray<Value> }) {
  const reduce = useReducedMotion();

  return (
    <m.ol
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
        <m.li
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
          <Card className="relative flex h-full flex-col overflow-hidden p-6 transition-colors duration-200 hover:border-ink/15 sm:p-8">
            <span
              aria-hidden
              className="pointer-events-none absolute -right-1 -top-4 select-none font-display text-7xl font-semibold leading-none text-accent/10"
            >
              {idx(i)}
            </span>
            <Glyph icon={iconFor(i)} className="size-6 text-accent" />
            <h3 className="mt-4 font-display text-xl font-medium text-ink">
              {v.title}
            </h3>
            <p className="mt-2 text-mute">{v.body}</p>
          </Card>
        </m.li>
      ))}
    </m.ol>
  );
}
