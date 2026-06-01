"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { Drawer } from "@/components/booking/Drawer";
import { Switch } from "@/components/shadcn/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/shadcn/ui/select";
import { DateRangePicker } from "@/components/admin/form/DateRangePicker";
import { TimeWheel } from "@/components/admin/form/time/TimeWheel";
import { bulkCreateSlots, type BulkSlotState } from "@/lib/admin/slot-actions";
import { LABEL, SUBMIT } from "@/components/admin/form/styles";
import { ru } from "@/lib/i18n/ru";
import { pluralRu } from "@/lib/i18n/plural";
import { AnimatedNumber } from "@/components/admin/form/AnimatedNumber";

export interface QuickAddPrefill {
  date?: string;
  start?: string;
}

const FORM_ID = "slot-planner-form";

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
const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6];
const DURATIONS = [15, 30, 45, 60, 90, 120];

/**
 * Slot creation in the shared slide-over `Drawer`. One unified form: pick a
 * single date *or* an interval (the weekday selector + the slice-duration field
 * appear only when they're meaningful). The save bar is the drawer's pinned
 * footer. Opened blank from "Планировщик" (defaults to a month range) or
 * prefilled from a click-to-create cell (single day + time).
 */
export function PlannerDrawer({
  open,
  onClose,
  prefill,
  todayKey,
}: {
  open: boolean;
  onClose: () => void;
  prefill?: QuickAddPrefill;
  todayKey: string;
}) {
  return (
    <PlannerForm
      key={`${prefill?.date ?? ""}-${prefill?.start ?? ""}`}
      open={open}
      onClose={onClose}
      prefill={prefill}
      todayKey={todayKey}
    />
  );
}

function PlannerForm({
  open,
  onClose,
  prefill,
  todayKey,
}: {
  open: boolean;
  onClose: () => void;
  prefill?: QuickAddPrefill;
  todayKey: string;
}) {
  const t = ru.admin.slots;
  const m = t.manager;
  const [state, action, pending] = useActionState<BulkSlotState, FormData>(
    bulkCreateSlots,
    undefined,
  );

  const [from, setFrom] = useState(prefill?.date ?? todayKey);
  const [to, setTo] = useState(() =>
    prefill?.date ? prefill.date : rangeEndFrom(todayKey),
  );
  const [start, setStart] = useState(prefill?.start ?? "11:00");
  const [end, setEnd] = useState(prefill?.start ? addMinutes(prefill.start, 60) : "19:00");
  const [slotMin, setSlotMin] = useState(60);
  const [days, setDays] = useState<number[]>([0, 1, 2, 3, 4]); // Mon–Fri

  // Close the drawer once the server action confirms windows were created.
  // (Reacting to the action result is exactly what an effect is for; we guard
  // with a ref so it fires once per successful submit.)
  const closedRef = useRef(false);
  useEffect(() => {
    if (state?.ok && state.created > 0 && !closedRef.current) {
      closedRef.current = true;
      onClose();
    }
  }, [state, onClose]);

  const isRange = Boolean(from && to && to !== from);

  // The chosen window length. When the interval is too short to split it's a
  // single window of exactly that length, so the duration field is hidden — no
  // point asking for "duration" on a 19:00–19:15 window.
  const intervalLen = Math.max(0, hhmmToMin(end) - hhmmToMin(start));
  const canSlice = intervalLen >= 30;
  const sliceOptions = DURATIONS.filter((d) => d <= intervalLen);
  const chosen =
    [...sliceOptions].reverse().find((d) => d <= slotMin) ??
    sliceOptions[0] ??
    60;
  const effSlotMin = canSlice ? chosen : intervalLen || 15;

  // Live preview of how many windows will be created. Cheap + all-primitive
  // inputs, so we let the React Compiler memoize it (a manual useMemo over the
  // derived `effSlotMin` trips preserve-manual-memoization).
  const previewCount = countSlots({
    from,
    to: to || from,
    days: isRange ? days : ALL_DAYS,
    start,
    end,
    slotMin: effSlotMin,
  });

  const toggleDay = (v: number) =>
    setDays((prev) =>
      prev.includes(v) ? prev.filter((d) => d !== v) : [...prev, v].sort(),
    );

  const footer = (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-4">
        <div className="flex flex-col gap-0.5">
          <span className={LABEL}>{t.bulkPreviewLabel}</span>
          <span className="flex items-baseline gap-1.5">
            <AnimatedNumber
              value={previewCount}
              countOnMount
              className="font-display text-2xl font-medium tabular-nums text-ink"
            />
            <span className="text-sm text-mute">
              {pluralRu(previewCount, t.windows)}
            </span>
          </span>
        </div>
        <button
          type="submit"
          form={FORM_ID}
          disabled={pending || previewCount === 0}
          className={SUBMIT}
        >
          {pending ? t.bulkSubmitting : t.bulkSubmit}
        </button>
      </div>
      <BulkStatus state={state} />
    </div>
  );

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={m.planner}
      subtitle={m.plannerSubtitle}
      footer={footer}
    >
      <form id={FORM_ID} action={action} className="flex flex-col gap-6">
        {/* Posted values. A single day still posts all weekdays so its one day
            matches; the slice length is the effective (clamped) value. */}
        <input type="hidden" name="from" value={from} />
        <input type="hidden" name="to" value={to || from} />
        <input type="hidden" name="slotMin" value={effSlotMin} />
        {!isRange
          ? ALL_DAYS.map((d) => (
              <input key={d} type="hidden" name="days" value={d} />
            ))
          : null}

        {/* Date — single or interval. */}
        <label className="flex flex-col gap-1.5">
          <span className={LABEL}>Дата или период</span>
          <DateRangePicker
            from={from}
            to={to}
            onChange={(f, tt) => {
              setFrom(f);
              setTo(tt);
            }}
            todayKey={todayKey}
            placeholder="Выберите дату"
            ariaLabel="Дата или период"
          />
        </label>

        {/* Weekdays — only meaningful for an interval. */}
        {isRange ? (
          <div className="flex flex-col gap-1.5">
            <span className={LABEL}>{t.bulkDaysLabel}</span>
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
          </div>
        ) : null}

        {/* Hours. */}
        <div className="flex flex-col gap-1.5">
          <span className={LABEL}>{t.bulkHoursLabel}</span>
          <div className="flex items-stretch gap-2">
            <div className="min-w-0 flex-1">
              <TimeWheel
                name="start"
                value={start}
                onChange={setStart}
                ariaLabel={t.startLabel}
              />
            </div>
            <span className="flex shrink-0 items-center text-mute">–</span>
            <div className="min-w-0 flex-1">
              <TimeWheel
                name="end"
                value={end}
                onChange={setEnd}
                ariaLabel={t.endLabel}
              />
            </div>
          </div>
        </div>

        {/* Slice length — only when the interval can hold more than one window. */}
        {canSlice ? (
          <label className="flex flex-col gap-1.5">
            <span className={LABEL}>{t.bulkSlotMinLabel}</span>
            <Select
              value={String(chosen)}
              onValueChange={(v) => setSlotMin(Number(v))}
            >
              <SelectTrigger className="h-11 w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {sliceOptions.map((d) => (
                  <SelectItem key={d} value={String(d)}>
                    {d} мин
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </label>
        ) : null}

        {/* Open for booking right away, or create the window closed. */}
        <label
          htmlFor="planner-isOpen"
          className="flex items-center justify-between gap-3"
        >
          <span className="text-sm text-ink">{t.isOpenLabel}</span>
          <Switch id="planner-isOpen" name="isOpen" defaultChecked />
        </label>
      </form>
    </Drawer>
  );
}

function BulkStatus({ state }: { state: BulkSlotState }) {
  if (!state) return null;
  const t = ru.admin.slots;
  if (state.ok) {
    return (
      <span role="status" aria-live="polite" className="text-sm font-medium text-success">
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

// ── Pure helpers (mirror the server's bulk algorithm for the live preview) ────

function pad(n: number): string {
  return String(n).padStart(2, "0");
}
function ymd(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// Last day of next month, derived from a yyyy-mm-dd key (deterministic).
function rangeEndFrom(key: string): string {
  const [y, mo, d] = key.split("-").map(Number);
  const dt = new Date(y, mo - 1, d);
  dt.setMonth(dt.getMonth() + 1);
  dt.setMonth(dt.getMonth() + 1);
  dt.setDate(0);
  return ymd(dt);
}

function addMinutes(hhmm: string, mins: number): string {
  const total = hhmmToMin(hhmm) + mins;
  const clamped = Math.min(total, 23 * 60 + 45);
  return `${pad(Math.floor(clamped / 60))}:${pad(clamped % 60)}`;
}

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
