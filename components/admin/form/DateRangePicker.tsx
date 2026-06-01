"use client";

import { useMemo, useRef, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/shadcn/ui/popover";
import { ru } from "@/lib/i18n/ru";
import { FIELD_H } from "@/components/admin/form/styles";

const DOW = [
  ru.admin.slots.dayShort.mon,
  ru.admin.slots.dayShort.tue,
  ru.admin.slots.dayShort.wed,
  ru.admin.slots.dayShort.thu,
  ru.admin.slots.dayShort.fri,
  ru.admin.slots.dayShort.sat,
  ru.admin.slots.dayShort.sun,
];

const RU_DAY_MONTH = new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long" });
const RU_DAY_MONTH_YEAR = new Intl.DateTimeFormat("ru-RU", {
  day: "numeric",
  month: "long",
  year: "numeric",
});
const RU_MONTH_YEAR = new Intl.DateTimeFormat("ru-RU", { month: "long", year: "numeric" });

function pad(n: number): string {
  return String(n).padStart(2, "0");
}
function ymd(y: number, m: number, d: number): string {
  return `${y}-${pad(m + 1)}-${pad(d)}`;
}
function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
function asDate(key: string): Date {
  return new Date(`${key}T00:00:00`);
}

interface Cell {
  day: number;
  key: string;
}

// Monday-first month grid (deterministic — no clock read).
function buildGrid(year: number, month: number): (Cell | null)[] {
  const jsDow = new Date(year, month, 1).getDay();
  const lead = (jsDow + 6) % 7;
  const dim = new Date(year, month + 1, 0).getDate();
  const cells: (Cell | null)[] = [];
  for (let i = 0; i < lead; i++) cells.push(null);
  for (let d = 1; d <= dim; d++) cells.push({ day: d, key: ymd(year, month, d) });
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

/**
 * Single-or-interval date picker. One field, one calendar: the first click
 * selects a single day (`from === to`); a second click extends it into a range.
 * Clicking away keeps the single day. `todayKey` (server clock) marks today.
 */
export function DateRangePicker({
  from,
  to,
  onChange,
  todayKey,
  placeholder,
  ariaLabel,
}: {
  from: string;
  to: string;
  onChange: (from: string, to: string) => void;
  todayKey: string;
  placeholder?: string;
  ariaLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const anchorRef = useRef<string | null>(null);
  const downRef = useRef(false);
  const movedRef = useRef(false);
  const [selecting, setSelecting] = useState(false);
  const [view, setView] = useState(() => {
    const seed = from || todayKey;
    const [y, m] = seed.split("-").map(Number);
    return { y, m: m - 1 };
  });

  const isRange = Boolean(from && to && to !== from);

  const label = useMemo(() => {
    if (!from) return "";
    if (!to || to === from) return cap(RU_DAY_MONTH_YEAR.format(asDate(from)));
    const sameYear = from.slice(0, 4) === to.slice(0, 4);
    const left = sameYear ? RU_DAY_MONTH.format(asDate(from)) : RU_DAY_MONTH_YEAR.format(asDate(from));
    return `${left} – ${RU_DAY_MONTH_YEAR.format(asDate(to))}`;
  }, [from, to]);

  const monthLabel = useMemo(
    () => cap(RU_MONTH_YEAR.format(new Date(view.y, view.m, 1))),
    [view],
  );
  const grid = useMemo(() => buildGrid(view.y, view.m), [view]);

  const step = (delta: number) =>
    setView((v) => {
      const d = new Date(v.y, v.m + delta, 1);
      return { y: d.getFullYear(), m: d.getMonth() };
    });

  // Selection model: click a start day, then click an end day to close a range
  // (Cal.com-style two-click). Press-and-drag across days works too. Past days
  // are disabled. We never auto-close — reselect freely, close by clicking away.
  const reset = () => {
    anchorRef.current = null;
    downRef.current = false;
    movedRef.current = false;
    setSelecting(false);
  };

  const onDown = (key: string) => {
    if (key < todayKey) return;
    if (selecting && anchorRef.current) {
      const a = anchorRef.current;
      if (key >= a) onChange(a, key);
      else onChange(key, a);
      reset();
      return;
    }
    anchorRef.current = key;
    onChange(key, key);
    setSelecting(true);
    downRef.current = true;
    movedRef.current = false;
  };

  const onEnter = (key: string) => {
    if (!downRef.current || !anchorRef.current || key < todayKey) return;
    movedRef.current = true;
    const a = anchorRef.current;
    if (key >= a) onChange(a, key);
    else onChange(key, a);
  };

  const onUp = () => {
    if (downRef.current && movedRef.current) reset(); // a drag completed
    else downRef.current = false; // a plain click — wait for the 2nd click
  };

  const onOpenChange = (next: boolean) => {
    setOpen(next);
    if (!next) reset();
  };

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger
        aria-label={ariaLabel}
        className={`${FIELD_H} flex items-center gap-2 text-left ${
          from ? "text-ink" : "text-mute/60"
        }`}
      >
        <CalendarDays className="size-4 shrink-0 text-mute" />
        <span className="truncate">{label || placeholder || "—"}</span>
      </PopoverTrigger>

      <PopoverContent align="start" className="w-72 p-3">
        <div className="mb-2 flex items-center justify-between">
          <button
            type="button"
            onClick={() => step(-1)}
            aria-label="Предыдущий месяц"
            className="flex size-8 items-center justify-center rounded-lg text-mute transition-colors hover:bg-ink/5 hover:text-ink"
          >
            <ChevronLeft className="size-4" />
          </button>
          <span className="text-sm font-medium text-ink">{monthLabel}</span>
          <button
            type="button"
            onClick={() => step(1)}
            aria-label="Следующий месяц"
            className="flex size-8 items-center justify-center rounded-lg text-mute transition-colors hover:bg-ink/5 hover:text-ink"
          >
            <ChevronRight className="size-4" />
          </button>
        </div>

        <div className="mb-1 grid grid-cols-7 gap-1">
          {DOW.map((d) => (
            <span
              key={d}
              className="flex h-7 items-center justify-center text-[11px] font-medium text-mute/70"
            >
              {d}
            </span>
          ))}
        </div>

        <div
          className="grid touch-none grid-cols-7 gap-1 select-none"
          onPointerUp={onUp}
          onPointerLeave={onUp}
        >
          {grid.map((cell, i) => {
            if (cell === null) return <span key={`b${i}`} />;
            const past = cell.key < todayKey;
            if (past) {
              return (
                <span
                  key={cell.key}
                  aria-disabled="true"
                  className="flex h-8 items-center justify-center text-sm tabular-nums text-mute/25"
                >
                  {cell.day}
                </span>
              );
            }
            const isEnd = cell.key === from || cell.key === to;
            const inRange = isRange && from < cell.key && to > cell.key;
            return (
              <button
                key={cell.key}
                type="button"
                onPointerDown={() => onDown(cell.key)}
                onPointerEnter={() => onEnter(cell.key)}
                onDoubleClick={() => {
                  // Double-click a single day = commit it and close.
                  onChange(cell.key, cell.key);
                  reset();
                  setOpen(false);
                }}
                aria-current={cell.key === todayKey ? "date" : undefined}
                className={`flex h-8 items-center justify-center rounded-lg text-sm tabular-nums transition-colors ${
                  isEnd
                    ? "bg-ink font-medium text-bg"
                    : inRange
                      ? "bg-ink/10 text-ink"
                      : cell.key === todayKey
                        ? "font-medium text-accent ring-1 ring-inset ring-accent/40 hover:bg-ink/5"
                        : "text-ink hover:bg-ink/5"
                }`}
              >
                {cell.day}
              </button>
            );
          })}
        </div>

        <p className="mt-2 px-0.5 text-[11px] leading-snug text-mute/70">
          Клик — начало, ещё клик — конец. Или протяните.
        </p>
      </PopoverContent>
    </Popover>
  );
}
