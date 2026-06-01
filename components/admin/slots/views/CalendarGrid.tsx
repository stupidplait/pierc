"use client";

import { type MouseEvent, useState } from "react";
import { AnimatePresence, motion, MotionConfig, type Variants } from "framer-motion";
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";
import { ru } from "@/lib/i18n/ru";
import type { WeekData } from "@/lib/admin/slots-view";
import { CARD } from "@/components/admin/form/styles";
import { SlotBlock } from "../SlotBlock";
import { DayMenu } from "../DayMenu";
import { useSlots } from "../context";

// Vertical scale of the time axis. 1.1px/min → a 12h day ≈ 792px, so windows
// are tall enough to read the time + customer.
const PX_PER_MIN = 1.1;
const SNAP_MIN = 30;
// Shared gutter width — the hour ruler and the nav buttons live here so the day
// columns line up between the (sliding) header and body.
const GUTTER = "w-20";
const HEADER_H = "h-10";

const NAV =
  "flex size-8 items-center justify-center rounded-lg border border-line bg-card text-mute transition-colors hover:border-ink/30 hover:text-ink active:scale-[0.95]";

// Proportional carousel: the slide distance equals the window delta as a
// fraction of the 7 columns, so a one-day step nudges by a single column (the
// six shared days appear to shift one over) while a one-week step is a full
// swap. Both layers are absolutely positioned so neither reflows — no flash.
const slide: Variants = {
  enter: (s: number) => ({ x: `${s * 100}%` }),
  center: { x: 0, transition: { duration: 0.34, ease: [0.16, 1, 0.3, 1] } },
  exit: (s: number) => ({
    x: `${-s * 100}%`,
    transition: { duration: 0.34, ease: [0.16, 1, 0.3, 1] },
  }),
};

function toHHMM(min: number): string {
  return `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(
    min % 60,
  ).padStart(2, "0")}`;
}

function daysBetween(a: string, b: string): number {
  return Math.round(
    (new Date(`${b}T00:00:00`).getTime() - new Date(`${a}T00:00:00`).getTime()) /
      86_400_000,
  );
}

/**
 * Time-axis week calendar. Day/week steppers sit inline at the ends of the
 * header row and navigate via `onNavigate` (a `useTransition`-wrapped router
 * push in the parent, so the current week stays on screen — no loading flash).
 * The date headers and body columns slide together by a distance proportional
 * to how far you stepped (one column per day, the full width per week).
 */
export function CalendarGrid({
  week,
  onNavigate,
}: {
  week: WeekData;
  onNavigate: (dateKey: string) => void;
}) {
  const { requestQuickAdd } = useSlots();
  const m = ru.admin.slots.manager;
  const { startMin, endMin } = week.axis;
  const total = endMin - startMin;
  const bodyHeight = total * PX_PER_MIN;

  // Slide fraction derived from the change in window (sanctioned adjust-state-
  // during-render pattern — works for arrows, "Сегодня" and the back button).
  const [prevKey, setPrevKey] = useState(week.weekStartKey);
  const [shift, setShift] = useState(0);
  if (prevKey !== week.weekStartKey) {
    const delta = daysBetween(prevKey, week.weekStartKey);
    setShift(Math.max(-1, Math.min(1, delta / 7)));
    setPrevKey(week.weekStartKey);
  }

  const hours: number[] = [];
  for (let h = Math.ceil(startMin / 60); h <= Math.floor(endMin / 60); h++) {
    hours.push(h * 60);
  }

  const onColumnClick = (e: MouseEvent<HTMLDivElement>, dateKey: string) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const raw = startMin + y / PX_PER_MIN;
    const snapped = Math.round(raw / SNAP_MIN) * SNAP_MIN;
    const clamped = Math.max(startMin, Math.min(snapped, endMin - SNAP_MIN));
    requestQuickAdd(dateKey, toHHMM(clamped));
  };

  return (
    <div className={`${CARD} overflow-x-auto p-3`}>
      <div className="min-w-184">
        {/* Header: fixed nav gutters + sliding date headers. */}
        <div className="flex items-stretch border-b border-line/70 pb-2">
          <div className={`${GUTTER} flex shrink-0 items-center justify-start gap-1`}>
            <button
              type="button"
              onClick={() => onNavigate(week.prevWeekKey)}
              aria-label={m.prevWeek}
              title={m.prevWeek}
              className={NAV}
            >
              <ChevronsLeft className="size-4" />
            </button>
            <button
              type="button"
              onClick={() => onNavigate(week.prevDayKey)}
              aria-label={m.prevDay}
              title={m.prevDay}
              className={NAV}
            >
              <ChevronLeft className="size-4" />
            </button>
          </div>

          <MotionConfig reducedMotion="user">
            <div className={`relative ${HEADER_H} flex-1 overflow-hidden`}>
              <AnimatePresence custom={shift} initial={false}>
                <motion.div
                  key={week.weekStartKey}
                  custom={shift}
                  variants={slide}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  className="absolute inset-0 flex bg-card select-none"
                >
                  {week.days.map((day) => (
                    <div
                      key={day.dateKey}
                      className={`flex flex-1 items-center justify-between gap-1 border-l border-line/60 px-1.5 ${
                        day.isToday ? "rounded-t-lg bg-accent/5" : ""
                      }`}
                    >
                      <div className="flex items-baseline gap-1.5">
                        <span
                          className={`text-xs font-medium uppercase tracking-wide ${
                            day.isToday ? "text-accent" : "text-mute"
                          }`}
                        >
                          {day.dowShort}
                        </span>
                        <span
                          className={`text-sm font-medium tabular-nums ${
                            day.isToday ? "text-accent" : "text-ink"
                          }`}
                        >
                          {day.dayNum}
                        </span>
                      </div>
                      <DayMenu day={day} />
                    </div>
                  ))}
                </motion.div>
              </AnimatePresence>
            </div>
          </MotionConfig>

          <div className={`${GUTTER} flex shrink-0 items-center justify-end gap-1`}>
            <button
              type="button"
              onClick={() => onNavigate(week.nextDayKey)}
              aria-label={m.nextDay}
              title={m.nextDay}
              className={NAV}
            >
              <ChevronRight className="size-4" />
            </button>
            <button
              type="button"
              onClick={() => onNavigate(week.nextWeekKey)}
              aria-label={m.nextWeek}
              title={m.nextWeek}
              className={NAV}
            >
              <ChevronsRight className="size-4" />
            </button>
          </div>
        </div>

        {/* Body: fixed hour ruler + sliding day columns. */}
        <div className="flex pt-2">
          <div className={`${GUTTER} relative shrink-0`} style={{ height: bodyHeight }}>
            {hours.map((h) => (
              <span
                key={h}
                className="absolute -translate-y-1/2 pr-2 text-right text-[11px] tabular-nums text-mute/70"
                style={{ top: (h - startMin) * PX_PER_MIN, right: 0 }}
              >
                {toHHMM(h)}
              </span>
            ))}
          </div>

          <MotionConfig reducedMotion="user">
            <div
              className="relative flex-1 overflow-hidden"
              style={{ height: bodyHeight }}
            >
              <AnimatePresence custom={shift} initial={false}>
                <motion.div
                  key={week.weekStartKey}
                  custom={shift}
                  variants={slide}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  className="absolute inset-0 flex bg-card select-none"
                >
                  {week.days.map((day) => (
                    <div
                      key={day.dateKey}
                      onClick={(e) => onColumnClick(e, day.dateKey)}
                      className={`relative h-full flex-1 cursor-copy border-l border-line/60 ${
                        day.isToday ? "bg-accent/5" : ""
                      }`}
                      role="presentation"
                    >
                      {hours.map((h) => (
                        <div
                          key={h}
                          className="pointer-events-none absolute inset-x-0 border-t border-line/40"
                          style={{ top: (h - startMin) * PX_PER_MIN }}
                        />
                      ))}
                      {day.slots.map((s) => (
                        <SlotBlock
                          key={s.id}
                          slot={s}
                          top={(s.startMin - startMin) * PX_PER_MIN}
                          height={(s.endMin - s.startMin) * PX_PER_MIN}
                        />
                      ))}
                    </div>
                  ))}
                </motion.div>
              </AnimatePresence>
            </div>
          </MotionConfig>

          <div className={`${GUTTER} shrink-0`} />
        </div>
      </div>
    </div>
  );
}
