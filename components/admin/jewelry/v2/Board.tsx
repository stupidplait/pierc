"use client";

import Link from "next/link";
import Image from "next/image";
import { motion, MotionConfig, type Variants } from "framer-motion";
import {
  ENTRANCE_DURATION,
  ENTRANCE_HIDDEN,
  ENTRANCE_SHOW,
  ENTRANCE_STAGGER,
  REVEAL_EASE,
} from "@/components/motion/entrance";
import { ru } from "@/lib/i18n/ru";
import { pluralRu } from "@/lib/i18n/plural";
import { JewelryStatusBadge } from "@/components/admin/StatusBadges";
import { StockAdjuster } from "@/components/admin/StockAdjuster";
import type { JewelryRow } from "../types";

export type { JewelryRow };

const container: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: ENTRANCE_STAGGER, delayChildren: 0.05 } },
};

const item: Variants = {
  hidden: ENTRANCE_HIDDEN,
  show: {
    ...ENTRANCE_SHOW,
    transition: { duration: ENTRANCE_DURATION, ease: REVEAL_EASE },
  },
};

// Mobile: a 2-row card (identity+status on top, price+stepper below) so the
// thumb and the stock stepper never starve the name to ~64px the way a single
// 320px row does. From sm up it collapses to the original single row.
const ROW =
  "flex flex-col gap-2 px-4 py-3 transition-colors duration-150 hover:bg-ink/3 sm:flex-row sm:items-center sm:gap-4 sm:px-5";

/**
 * Catalog list (v2) — divided rows without the surrounding CARD (the orchestrator
 * owns the card so it can dock the status tabs and swap in the skeleton during a
 * filter transition). `animateIn` runs the staggered blur-reveal on the genuine
 * first paint only; filter/search updates skip it (the skeleton swap is the
 * feedback).
 */
export function JewelryBoardV2({
  rows,
  animateIn = true,
}: {
  rows: JewelryRow[];
  animateIn?: boolean;
}) {
  const t = ru.admin.jewelry;

  if (rows.length === 0) {
    return (
      <p className="px-6 py-14 text-center text-sm text-mute sm:py-16">
        {t.empty}
      </p>
    );
  }

  if (!animateIn) {
    return (
      <ul className="divide-y divide-line/70">
        {rows.map((j) => (
          <li key={j.id} className={ROW}>
            <Row j={j} countOnMount={false} />
          </li>
        ))}
      </ul>
    );
  }

  return (
    <MotionConfig reducedMotion="user">
      <motion.ul
        variants={container}
        initial="hidden"
        animate="show"
        className="divide-y divide-line/70"
      >
        {rows.map((j) => (
          <motion.li key={j.id} variants={item} className={ROW}>
            <Row j={j} countOnMount />
          </motion.li>
        ))}
      </motion.ul>
    </MotionConfig>
  );
}

/** Row body — shared by the animated and static list variants. */
function Row({ j, countOnMount }: { j: JewelryRow; countOnMount: boolean }) {
  return (
    <>
      <Link
        href={`/admin/jewelry/${j.id}/edit`}
        className="flex min-w-0 flex-1 items-center gap-3 sm:gap-4"
      >
        <span className="relative size-12 shrink-0 overflow-hidden rounded-xl bg-bg sm:size-14">
          {j.photo ? (
            <Image
              src={j.photo}
              alt=""
              fill
              sizes="(min-width: 640px) 56px, 48px"
              className="object-cover"
            />
          ) : null}
        </span>

        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2">
            <span className="truncate text-sm font-medium text-ink">
              {j.name}
            </span>
            {j.featured ? (
              <span className="shrink-0 rounded-full bg-accent/15 px-1.5 py-0.5 text-xs font-medium text-accent">
                ★
              </span>
            ) : null}
          </span>
          <span className="mt-0.5 block truncate text-xs text-mute">
            {j.categoryName} · {j.material} · {j.anchorCount}{" "}
            {pluralRu(j.anchorCount, {
              one: "якорь",
              few: "якоря",
              many: "якорей",
            })}
          </span>
        </span>

        {/* Mobile: price beside the name (keeps the name line as wide as
            possible — the badge + stepper share the row below). */}
        <span className="shrink-0 text-sm font-medium tabular-nums text-ink sm:hidden">
          {j.price}
        </span>

        {/* sm+: price over status, right-aligned. */}
        <span className="hidden shrink-0 flex-col items-end gap-1 sm:flex">
          <span className="text-sm font-medium tabular-nums text-ink">
            {j.price}
          </span>
          <JewelryStatusBadge status={j.status} />
        </span>
      </Link>

      {/* Mobile: status badge + stock stepper on a second row. sm+: just the
          stepper, trailing the row. */}
      <div className="flex items-center justify-between gap-3 sm:w-auto sm:justify-end">
        <span className="sm:hidden">
          <JewelryStatusBadge status={j.status} />
        </span>
        <span className="shrink-0">
          <StockAdjuster
            jewelryId={j.id}
            stock={j.inStock}
            countOnMount={countOnMount}
          />
        </span>
      </div>
    </>
  );
}
