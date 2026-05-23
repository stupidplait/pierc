"use client";

import { useActionState, useMemo, useState } from "react";
import {
  bulkCreateSlots,
  type BulkSlotState,
} from "@/lib/admin/slot-actions";
import { ru } from "@/lib/i18n/ru";

// 0=Mon ... 6=Sun (ISO order).
const DAYS = [
  { value: 0, label: ru.admin.slots.dayShort.mon },
  { value: 1, label: ru.admin.slots.dayShort.tue },
  { value: 2, label: ru.admin.slots.dayShort.wed },
  { value: 3, label: ru.admin.slots.dayShort.thu },
  { value: 4, label: ru.admin.slots.dayShort.fri },
  { value: 5, label: ru.admin.slots.dayShort.sat },
  { value: 6, label: ru.admin.slots.dayShort.sun },
] as const;

// Sensible defaults: today в†’ end of next month, Tue-Sat 11:00вЂ“19:00, 60 min.
function defaultRange() {
  const from = new Date();
  from.setHours(0, 0, 0, 0);
  const to = new Date(from);
  to.setMonth(to.getMonth() + 1);
  // Go to last day of that month.
  to.setMonth(to.getMonth() + 1);
  to.setDate(0);
  return {
    from: ymd(from),
    to: ymd(to),
  };
}

function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function BulkSlotForm() {
  const [state, action, pending] = useActionState<BulkSlotState, FormData>(
    bulkCreateSlots,
    undefined,
  );

  const defaults = useMemo(() => defaultRange(), []);
  const [from, setFrom] = useState(defaults.from);
  const [to, setTo] = useState(defaults.to);
  const [start, setStart] = useState("11:00");
  const [end, setEnd] = useState("19:00");
  const [slotMin, setSlotMin] = useState(60);
  const [days, setDays] = useState<number[]>([1, 2, 3, 4, 5]); // Tue-Sat default

  const t = ru.admin.slots;

  // Live preview of how many slots will be created.
  const previewCount = useMemo(() => {
    return countSlots({ from, to, start, end, slotMin, days });
  }, [from, to, start, end, slotMin, days]);

  const toggleDay = (v: number) => {
    setDays((prev) =>
      prev.includes(v) ? prev.filter((d) => d !== v) : [...prev, v].sort(),
    );
  };

  return (
    <form action={action} className="flex flex-col gap-5">
      {/* Range */}
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1">
          <span className="text-xs uppercase tracking-[0.15em] text-mute">
            {t.bulkFromLabel}
          </span>
          <input
            type="date"
            name="from"
            required
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="h-11 rounded-xl border border-line bg-page px-4 text-ink outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/30"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs uppercase tracking-[0.15em] text-mute">
            {t.bulkToLabel}
          </span>
          <input
            type="date"
            name="to"
            required
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="h-11 rounded-xl border border-line bg-page px-4 text-ink outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/30"
          />
        </label>
      </div>

      {/* Days of week */}
      <fieldset className="flex flex-col gap-2">
        <legend className="text-xs uppercase tracking-[0.15em] text-mute">
          {t.bulkDaysLabel}
        </legend>
        <div className="flex flex-wrap gap-2">
          {DAYS.map((d) => {
            const active = days.includes(d.value);
            return (
              <label
                key={d.value}
                className={`cursor-pointer rounded-full border px-4 py-1.5 text-sm font-medium transition-colors ${
                  active
                    ? "border-primary bg-primary text-on-primary"
                    : "border-line text-ink hover:border-primary"
                }`}
              >
                <input
                  type="checkbox"
                  name="days"
                  value={d.value}
                  checked={active}
                  onChange={() => toggleDay(d.value)}
                  className="sr-only"
                />
                {d.label}
              </label>
            );
          })}
        </div>
      </fieldset>

      {/* Hours + slot length */}
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="flex flex-col gap-1">
          <span className="text-xs uppercase tracking-[0.15em] text-mute">
            {t.bulkHoursLabel}
          </span>
          <div className="flex items-center gap-2">
            <input
              type="time"
              name="start"
              required
              value={start}
              onChange={(e) => setStart(e.target.value)}
              className="h-11 w-full rounded-xl border border-line bg-page px-3 text-ink outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/30"
            />
            <span className="text-mute">вЂ“</span>
            <input
              type="time"
              name="end"
              required
              value={end}
              onChange={(e) => setEnd(e.target.value)}
              className="h-11 w-full rounded-xl border border-line bg-page px-3 text-ink outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/30"
            />
          </div>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs uppercase tracking-[0.15em] text-mute">
            {t.bulkSlotMinLabel}
          </span>
          <input
            type="number"
            name="slotMin"
            min={15}
            max={480}
            step={5}
            required
            value={slotMin}
            onChange={(e) => setSlotMin(Number(e.target.value))}
            className="h-11 rounded-xl border border-line bg-page px-4 text-ink outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/30"
          />
        </label>
        <div className="flex flex-col justify-end">
          <p className="rounded-xl border border-line bg-card px-4 py-3 text-sm text-mute">
            {t.bulkPreview.replace("{n}", String(previewCount))}
          </p>
        </div>
      </div>

      {state ? (
        state.ok ? (
          <p className="rounded-lg border border-success/40 bg-success-soft px-4 py-3 text-sm text-success">
            {t.bulkResult
              .replace("{created}", String(state.created))
              .replace("{skipped}", String(state.skipped))}
          </p>
        ) : (
          <p className="rounded-lg border border-error/40 bg-error-soft px-4 py-3 text-sm text-error">
            {state.error}
          </p>
        )
      ) : null}

      <div>
        <button
          type="submit"
          disabled={pending || previewCount === 0}
          className="inline-flex h-11 items-center justify-center rounded-full bg-primary px-6 text-sm font-medium text-on-primary transition-colors hover:bg-primary-soft disabled:opacity-50"
        >
          {pending ? t.bulkSubmitting : t.bulkSubmit}
        </button>
      </div>

      <p className="text-xs text-mute">{t.timezoneNote}</p>
    </form>
  );
}

// Pure client-side preview matching the server's algorithm. Approximate but
// matches dedupe-free count (server may report fewer if some slots already exist).
function countSlots({
  from,
  to,
  days,
  start,
  end,
  slotMin,
}: {
  from: string;
  to: string;
  days: number[];
  start: string;
  end: string;
  slotMin: number;
}): number {
  if (!from || !to || !start || !end || !slotMin || days.length === 0) return 0;
  const startMin = hhmmToMin(start);
  const endMin = hhmmToMin(end);
  if (endMin <= startMin) return 0;
  const perDay = Math.floor((endMin - startMin) / slotMin);
  if (perDay <= 0) return 0;

  const fromD = new Date(from + "T00:00:00");
  const toD = new Date(to + "T00:00:00");
  if (toD < fromD) return 0;

  let matchingDays = 0;
  let safety = 0;
  const cursor = new Date(fromD);
  const daysSet = new Set(days);
  while (cursor <= toD && safety < 400) {
    safety++;
    const jsDow = cursor.getDay();
    const isoDow = jsDow === 0 ? 6 : jsDow - 1;
    if (daysSet.has(isoDow)) matchingDays++;
    cursor.setDate(cursor.getDate() + 1);
  }
  return matchingDays * perDay;
}

function hhmmToMin(s: string): number {
  const [h, m] = s.split(":").map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return 0;
  return h * 60 + m;
}
