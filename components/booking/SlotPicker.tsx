"use client";

import { useId, useState } from "react";
import {
  AnimatePresence,
  LayoutGroup,
  motion,
  useReducedMotion,
} from "framer-motion";
import type { WizardSlot } from "@/lib/booking/wizard-types";
import { ru } from "@/lib/i18n/ru";
import { SITE } from "@/lib/site";

const RU_WEEKDAY = new Intl.DateTimeFormat("ru-RU", { weekday: "short" });
const RU_MONTH = new Intl.DateTimeFormat("ru-RU", { month: "short" });
const RU_FULLDAY = new Intl.DateTimeFormat("ru-RU", {
  weekday: "long",
  day: "numeric",
  month: "long",
});
const RU_TIME = new Intl.DateTimeFormat("ru-RU", {
  hour: "2-digit",
  minute: "2-digit",
});

function formatTime(iso: string): string {
  return RU_TIME.format(new Date(iso));
}
function fullDay(key: string): string {
  return RU_FULLDAY.format(new Date(key));
}
function dayKeyOffset(offset: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + offset);
  return d.toISOString().slice(0, 10);
}
function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
function tile(key: string): { weekday: string; day: string; month: string } {
  const d = new Date(key);
  const day = String(Number(key.slice(8, 10)));
  const month = RU_MONTH.format(d).replace(".", "");
  if (key === dayKeyOffset(0))
    return { weekday: ru.pages.book.slotStep.today, day, month };
  if (key === dayKeyOffset(1))
    return { weekday: ru.pages.book.slotStep.tomorrow, day, month };
  return { weekday: cap(RU_WEEKDAY.format(d)).replace(".", ""), day, month };
}

interface DayGroup {
  key: string;
  slots: WizardSlot[];
}

function groupByDay(slots: WizardSlot[]): DayGroup[] {
  const groups: DayGroup[] = [];
  const byKey = new Map<string, DayGroup>();
  for (const s of slots) {
    const key = s.startsAt.slice(0, 10);
    let g = byKey.get(key);
    if (!g) {
      g = { key, slots: [] };
      byKey.set(key, g);
      groups.push(g);
    }
    g.slots.push(s);
  }
  return groups;
}

interface SlotPickerProps {
  slots: WizardSlot[];
  value: string | null;
  /** Select a time (does not advance). */
  onChange: (id: string) => void;
  /** Re-click / double-click the already-selected time → confirm/advance. */
  onConfirm?: () => void;
  loading?: boolean;
}

export function SlotPicker({
  slots,
  value,
  onChange,
  onConfirm,
  loading,
}: SlotPickerProps) {
  const reduce = useReducedMotion();
  const uid = useId();
  const timeGroupName = useId();
  const groups = groupByDay(slots);

  const [selectedDay, setSelectedDay] = useState<string | null>(() => {
    if (value) {
      const found = slots.find((s) => s.id === value);
      if (found) return found.startsAt.slice(0, 10);
    }
    return null;
  });

  // Only morph when the user opens/closes/switches a date themselves. On a
  // remount (e.g. returning to step 2 with a slot already chosen) the panel
  // should just be there — no replayed dynamic-island animation. The flag is
  // set in click handlers (never in an effect, which the lint rules forbid),
  // so a fresh mount renders without the shared layoutId and skips the morph.
  const [interacted, setInteracted] = useState(false);
  const skipMorph = !interacted;

  if (loading) {
    return (
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4" aria-busy="true">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-20 animate-pulse rounded-xl bg-card" />
        ))}
      </div>
    );
  }

  if (groups.length === 0) {
    return (
      <div className="flex flex-col items-start gap-3">
        <p className="text-sm text-mute">{ru.pages.book.slotStep.empty}</p>
        <a
          href={SITE.telegram}
          target="_blank"
          rel="noreferrer noopener"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-primary transition-opacity hover:opacity-80"
        >
          {ru.pages.book.slotStep.emptyCta} <span aria-hidden="true">→</span>
        </a>
      </div>
    );
  }

  const activeGroup = groups.find((g) => g.key === selectedDay) ?? null;
  // The currently-chosen slot, surfaced back onto the day grid so a selection is
  // never invisible once the time panel collapses.
  const selectedSlot = value ? (slots.find((s) => s.id === value) ?? null) : null;
  const selectedSlotDay = selectedSlot ? selectedSlot.startsAt.slice(0, 10) : null;
  const selectedTime = selectedSlot
    ? `${formatTime(selectedSlot.startsAt)}–${formatTime(selectedSlot.endsAt)}`
    : null;
  const morph = reduce
    ? { duration: 0 }
    : { type: "spring" as const, stiffness: 300, damping: 30 };

  return (
    <LayoutGroup id={uid}>
      <div className="relative">
        {/* Calendar grid — stays mounted; the pressed tile is the morph source.
            This wrapper is the panel's coverage box: the panel uses inset-0
            against it so it always matches the grid's exact rectangle. */}
        <div className="relative grid grid-cols-3 gap-2 sm:grid-cols-4">
          {groups.map((g) => {
            const { weekday, day, month } = tile(g.key);
            const isActive = activeGroup?.key === g.key;
            const isChosen = selectedSlotDay === g.key;
            return (
              <motion.button
                key={g.key}
                layoutId={`${uid}-tile-${g.key}`}
                type="button"
                onClick={() => {
                  setInteracted(true);
                  setSelectedDay(g.key);
                }}
                transition={morph}
                aria-hidden={isActive}
                style={{ visibility: isActive ? "hidden" : "visible" }}
                className={`flex flex-col items-center gap-0.5 rounded-xl border bg-card px-2 py-3 text-center transition-colors active:scale-[0.98] ${
                  isChosen
                    ? "border-primary"
                    : "border-line hover:border-primary/40"
                }`}
              >
                <span className="text-[11px] uppercase tracking-[0.1em] text-mute">
                  {weekday}
                </span>
                <motion.span
                  layoutId={`${uid}-day-${g.key}`}
                  transition={morph}
                  className="text-xl font-medium text-ink tabular-nums"
                >
                  {day}
                </motion.span>
                {isChosen && selectedTime ? (
                  <span className="whitespace-nowrap text-[10px] font-medium text-primary tabular-nums">
                    {selectedTime}
                  </span>
                ) : (
                  <span className="text-[11px] text-mute">{month}</span>
                )}
              </motion.button>
            );
          })}

          {/* Time panel — covers the exact rectangle of the grid (inset-0)
              and morphs out of the pressed tile. Compact column layout so
              the header and pills sit at the top with no dead space. */}
          <AnimatePresence mode="popLayout" initial={false}>
            {activeGroup ? (
              <motion.div
                key={`island-${activeGroup.key}`}
                layoutId={skipMorph ? undefined : `${uid}-tile-${activeGroup.key}`}
                transition={morph}
                className="absolute inset-0 z-10 flex flex-col rounded-xl border border-line bg-card p-3 shadow-elev-overlay"
              >
                <button
                  type="button"
                  onClick={() => {
                    setInteracted(true);
                    setSelectedDay(null);
                  }}
                  className="mb-2 inline-flex w-full items-center gap-2 text-left text-xs uppercase tracking-[0.15em] text-mute transition-colors hover:text-ink"
                >
                  <span aria-hidden="true">←</span>
                  <motion.span
                    layoutId={skipMorph ? undefined : `${uid}-day-${activeGroup.key}`}
                    transition={morph}
                    className="text-base font-medium normal-case tracking-normal text-ink"
                  >
                    {fullDay(activeGroup.key)}
                  </motion.span>
                </button>
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: reduce ? 0 : 0.18, delay: reduce ? 0 : 0.05 }}
                  className="grid grid-cols-2 gap-2"
                >
                  {activeGroup.slots.map((s) => {
                    const active = value === s.id;
                    return (
                      <label
                        key={s.id}
                        className={`block cursor-pointer rounded-xl border px-4 py-2.5 text-center text-sm font-medium tabular-nums transition-colors active:scale-[0.99] focus-within:ring-2 focus-within:ring-primary/30 ${
                          active
                            ? "border-primary bg-primary text-on-primary"
                            : "border-line text-ink hover:border-primary"
                        }`}
                      >
                        <input
                          type="radio"
                          name={timeGroupName}
                          className="sr-only"
                          checked={active}
                          onChange={() => {
                            onChange(s.id);
                            // Collapse back to the grid so the chosen time is
                            // shown on its day tile; the panel morphs into the
                            // tile via the shared layoutId.
                            setInteracted(true);
                            setSelectedDay(null);
                          }}
                          onClick={() => {
                            if (active) onConfirm?.();
                          }}
                        />
                        {formatTime(s.startsAt)} – {formatTime(s.endsAt)}
                      </label>
                    );
                  })}
                </motion.div>
              </motion.div>
            ) : null}
          </AnimatePresence>
        </div>
      </div>
    </LayoutGroup>
  );
}
