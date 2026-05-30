"use client";

import { useActionState, useMemo, useState } from "react";
import {
  bulkCreateSlots,
  type BulkSlotState,
} from "@/lib/admin/slot-actions";
import { CardHeader, Reveal } from "@/components/admin/form/atelier";
import { CARD, LABEL, SUBMIT } from "@/components/admin/form/styles";
import { Input } from "@/components/shadcn/ui/input";
import { ru } from "@/lib/i18n/ru";
import { pluralRu } from "@/lib/i18n/plural";

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

// Sensible defaults: today → end of next month, Tue-Sat 11:00–19:00, 60 min.
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

export function BulkSlotForm({ delay = 0 }: { delay?: number }) {
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
    <Reveal delay={delay}>
      <form action={action} className={`${CARD} flex flex-col gap-6 p-6 sm:p-7`}>
        <CardHeader title={t.bulkHeading} lead={t.bulkLead} />

        {/* Range */}
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-1.5">
            <span className={LABEL}>{t.bulkFromLabel}</span>
            <Input
              type="date"
              name="from"
              required
              value={from}
              onChange={(e) => setFrom(e.target.value)}
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className={LABEL}>{t.bulkToLabel}</span>
            <Input
              type="date"
              name="to"
              required
              value={to}
              onChange={(e) => setTo(e.target.value)}
            />
          </label>
        </div>

        {/* Days of week */}
        <fieldset className="flex flex-col gap-2.5">
          <legend className={LABEL}>{t.bulkDaysLabel}</legend>
          <div className="flex flex-wrap gap-2">
            {DAYS.map((d) => {
              const active = days.includes(d.value);
              return (
                <label
                  key={d.value}
                  className={`cursor-pointer select-none rounded-lg border px-3.5 py-2 text-sm font-medium transition-colors ${
                    active
                      ? "border-ink bg-ink text-bg"
                      : "border-ink/15 text-mute hover:border-ink/40 hover:text-ink"
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
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-1.5">
            <span className={LABEL}>{t.bulkHoursLabel}</span>
            <div className="flex items-center gap-2">
              <Input
                type="time"
                name="start"
                required
                value={start}
                onChange={(e) => setStart(e.target.value)}
              />
              <span className="text-mute">–</span>
              <Input
                type="time"
                name="end"
                required
                value={end}
                onChange={(e) => setEnd(e.target.value)}
              />
            </div>
          </label>
          <label className="flex flex-col gap-1.5">
            <span className={LABEL}>{t.bulkSlotMinLabel}</span>
            <Input
              type="number"
              name="slotMin"
              min={15}
              max={480}
              step={5}
              required
              value={slotMin}
              onChange={(e) => setSlotMin(Number(e.target.value))}
            />
          </label>
        </div>

        {/* Focal preview + submit */}
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-ink/10 bg-ink/3 px-5 py-4">
          <div className="flex flex-col gap-0.5">
            <span className={LABEL}>{t.bulkPreviewLabel}</span>
            <span className="flex items-baseline gap-1.5">
              <span className="font-display text-3xl font-medium tabular-nums text-ink">
                {previewCount}
              </span>
              <span className="text-sm text-mute">
                {pluralRu(previewCount, t.windows)}
              </span>
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <BulkStatus state={state} />
            <button
              type="submit"
              disabled={pending || previewCount === 0}
              className={SUBMIT}
            >
              {pending ? t.bulkSubmitting : t.bulkSubmit}
            </button>
          </div>
        </div>

        <p className="text-xs text-mute">{t.timezoneNote}</p>
      </form>
    </Reveal>
  );
}

// Quiet inline status — matches the settings/atelier `InlineStatus` vocabulary
// rather than the old full-width banners.
function BulkStatus({ state }: { state: BulkSlotState }) {
  if (!state) return null;
  const t = ru.admin.slots;
  if (state.ok) {
    return (
      <span
        role="status"
        aria-live="polite"
        className="text-sm font-medium text-success"
      >
        {t.bulkResult
          .replace("{created}", String(state.created))
          .replace("{skipped}", String(state.skipped))}
      </span>
    );
  }
  return (
    <span role="alert" aria-live="assertive" className="text-sm text-error">
      {state.error}
    </span>
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
