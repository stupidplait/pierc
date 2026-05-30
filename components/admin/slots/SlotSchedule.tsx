"use client";

import { useMemo, useState } from "react";
import { motion, MotionConfig, type Variants } from "framer-motion";
import {
  ENTRANCE_DURATION,
  ENTRANCE_HIDDEN,
  ENTRANCE_SHOW,
  ENTRANCE_STAGGER,
  REVEAL_EASE,
} from "@/components/services/entrance/config";
import { ru } from "@/lib/i18n/ru";
import { pluralRu } from "@/lib/i18n/plural";
import { CARD } from "@/components/admin/form/styles";
import { SlotChip, type SlotRow } from "./SlotChip";
import { slotStatusLabel, type SlotStatus } from "./status";

export interface SlotDayGroup {
  dateKey: string;
  dateLabel: string;
  slots: SlotRow[];
}

export interface SlotCounts {
  all: number;
  free: number;
  booked: number;
  closed: number;
}

type Filter = "all" | SlotStatus;

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

/**
 * Schedule — a segmented status filter strip above the day-grouped chip grid.
 * Filtering is purely local (`useState`); the list isn't server-paginated, so
 * narrowing just hides chips and any emptied day. Mirrors the jewelry catalog's
 * filter-strip + staggered-card vocabulary.
 */
export function SlotSchedule({
  groups,
  counts,
}: {
  groups: SlotDayGroup[];
  counts: SlotCounts;
}) {
  const t = ru.admin.slots;
  const [filter, setFilter] = useState<Filter>("all");

  const visibleGroups = useMemo(() => {
    if (filter === "all") return groups;
    return groups
      .map((g) => ({ ...g, slots: g.slots.filter((s) => s.status === filter) }))
      .filter((g) => g.slots.length > 0);
  }, [groups, filter]);

  const hasSlots = counts.all > 0;

  return (
    <MotionConfig reducedMotion="user">
      <section className="flex flex-col gap-5">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2">
          <h2 className="font-display text-xl font-medium tracking-tight text-ink">
            {t.scheduleHeading}
          </h2>
          {hasSlots ? (
            <div className="inline-flex flex-wrap gap-1 rounded-xl border border-line bg-card p-1">
              <FilterChip
                label={t.filterAll}
                count={counts.all}
                active={filter === "all"}
                onSelect={() => setFilter("all")}
              />
              {(["free", "booked", "closed"] as const).map((s) => (
                <FilterChip
                  key={s}
                  label={slotStatusLabel(s)}
                  count={counts[s]}
                  active={filter === s}
                  onSelect={() => setFilter(s)}
                />
              ))}
            </div>
          ) : null}
        </div>

        {!hasSlots ? (
          <div className={`${CARD} px-6 py-16 text-center text-sm text-mute`}>
            {t.empty}
          </div>
        ) : visibleGroups.length === 0 ? (
          <div className={`${CARD} px-6 py-16 text-center text-sm text-mute`}>
            {t.filterEmpty}
          </div>
        ) : (
          <motion.div
            key={filter}
            variants={container}
            initial="hidden"
            animate="show"
            className="flex flex-col gap-5"
          >
            {visibleGroups.map((g) => (
              <motion.section
                key={g.dateKey}
                variants={item}
                className={`${CARD} p-5 sm:p-6`}
              >
                <div className="flex items-baseline justify-between gap-3 border-b border-line/70 pb-4">
                  <h3 className="font-display text-lg font-medium tracking-tight text-ink">
                    {g.dateLabel}
                  </h3>
                  <span className="shrink-0 text-xs text-mute tabular-nums">
                    {g.slots.length} {pluralRu(g.slots.length, t.windows)}
                  </span>
                </div>
                <div className="flex flex-wrap gap-2 pt-4">
                  {g.slots.map((s) => (
                    <SlotChip key={s.id} slot={s} />
                  ))}
                </div>
              </motion.section>
            ))}
          </motion.div>
        )}
      </section>
    </MotionConfig>
  );
}

/** One segment of the status filter — ink-fill active chip / quiet inactive chip
 *  with a count, matching the jewelry catalog's `StatusChip`. */
function FilterChip({
  label,
  count,
  active,
  onSelect,
}: {
  label: string;
  count: number;
  active: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-current={active ? "true" : undefined}
      className={`flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-sm font-medium transition-colors duration-150 ${
        active ? "bg-ink text-bg" : "text-mute hover:text-ink"
      }`}
    >
      <span>{label}</span>
      <span
        className={`text-xs tabular-nums ${active ? "text-bg/65" : "text-mute/65"}`}
      >
        {count}
      </span>
    </button>
  );
}
