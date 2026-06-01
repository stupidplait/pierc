// Week-scoped slot view model. The slots page reads one Mon–Sun window and
// derives this fully-serializable shape so the client views (board / calendar /
// list) stay pure presentation: every label is formatted server-side and every
// time is reduced to minutes-from-midnight, so no `Date` math runs in render
// (React Compiler purity) and there's no client-side timezone drift.
//
// Timezone convention (v1): all times are server-local, matching `combineDate`
// in `lib/admin/slot-actions.ts` and the `Intl` formatters below. Studios are
// assumed to be in one zone; see the note there.

import { ru } from "@/lib/i18n/ru";
import type { SlotStatus } from "@/components/admin/slots/status";

// ── Serializable shapes handed to the client ────────────────────────────────

export interface SlotRow {
  id: string;
  /** Start time only, for the chip face — e.g. "11:00". */
  timeLabel: string;
  /** Full range, for the popover/block — e.g. "11:00–12:00". */
  rangeLabel: string;
  /** Minutes from midnight (studio-local), for time-axis positioning. */
  startMin: number;
  endMin: number;
  status: SlotStatus;
  /** Booking details — present only for a booked window. */
  appointment?: {
    id: string;
    statusLabel: string;
    customer: string;
    service: string | null;
  };
}

export interface SlotCounts {
  all: number;
  free: number;
  booked: number;
  closed: number;
}

export interface SlotDay {
  /** yyyy-mm-dd (studio-local) — stable key + the value passed to quick-add. */
  dateKey: string;
  /** "Вторник, 3 июня" — full label for the list view's day header. */
  dateLabel: string;
  /** "Вт" — short weekday for board / calendar column headers. */
  dowShort: string;
  /** Day-of-month number for compact column headers. */
  dayNum: number;
  isToday: boolean;
  slots: SlotRow[];
  counts: SlotCounts;
}

export interface WeekData {
  /** yyyy-mm-dd of the leftmost (first) day — identity of the visible window. */
  weekStartKey: string;
  prevWeekKey: string;
  nextWeekKey: string;
  /** ±1 day, for fine-grained stepping of the rolling 7-day window. */
  prevDayKey: string;
  nextDayKey: string;
  /** yyyy-mm-dd of "today" (server clock) — for the date picker's marker. */
  todayKey: string;
  /** "2–8 июня" (or "30 июня – 6 июля" across a month boundary). */
  rangeLabel: string;
  days: SlotDay[];
  counts: SlotCounts;
  /** Hour-snapped axis bounds for the time-grid view (minutes from midnight). */
  axis: { startMin: number; endMin: number };
}

// Loose input shape — matches the page's `findMany` projection.
export interface SlotInput {
  id: string;
  startsAt: Date;
  endsAt: Date;
  isOpen: boolean;
  appointment: {
    id: string;
    status: string;
    user: { name: string };
    service: { name: string } | null;
  } | null;
}

// ── Formatters (server-local, ru) ───────────────────────────────────────────

const RU_TIME = new Intl.DateTimeFormat("ru-RU", {
  hour: "2-digit",
  minute: "2-digit",
});
const RU_FULL_DAY = new Intl.DateTimeFormat("ru-RU", {
  weekday: "long",
  day: "numeric",
  month: "long",
});
const RU_DAY_MONTH = new Intl.DateTimeFormat("ru-RU", {
  day: "numeric",
  month: "long",
});

const DOW_SHORT = [
  ru.admin.slots.dayShort.mon,
  ru.admin.slots.dayShort.tue,
  ru.admin.slots.dayShort.wed,
  ru.admin.slots.dayShort.thu,
  ru.admin.slots.dayShort.fri,
  ru.admin.slots.dayShort.sat,
  ru.admin.slots.dayShort.sun,
];

// Calendar axis defaults / clamps (minutes from midnight).
const AXIS_DEFAULT_START = 9 * 60;
const AXIS_DEFAULT_END = 21 * 60;

// ── Pure helpers ─────────────────────────────────────────────────────────────

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function minutesOf(d: Date): number {
  return d.getHours() * 60 + d.getMinutes();
}

function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;
}

function addDays(d: Date, n: number): Date {
  const out = new Date(d);
  out.setDate(out.getDate() + n);
  return out;
}

function emptyCounts(): SlotCounts {
  return { all: 0, free: 0, booked: 0, closed: 0 };
}

/** Monday 00:00 (studio-local) of the week containing `d`. */
export function weekStartOf(d: Date): Date {
  const out = new Date(d);
  out.setHours(0, 0, 0, 0);
  const dow = out.getDay(); // 0=Sun..6=Sat
  const diff = dow === 0 ? -6 : 1 - dow; // back to Monday
  out.setDate(out.getDate() + diff);
  return out;
}

function statusOf(s: SlotInput): SlotStatus {
  const taken = s.appointment && s.appointment.status !== "CANCELLED";
  return taken ? "booked" : s.isOpen ? "free" : "closed";
}

/**
 * Build the view model from the raw slots of a 7-day window starting at
 * `weekStart` (its 00:00). The window is rolling — `weekStart` can be any day
 * (Monday by default, but day-stepping shifts it freely), so this no longer
 * snaps to Monday. `now` is the request's clock read, kept out of this pure
 * function so it never sits in a render body.
 */
export function buildWeek(
  slots: SlotInput[],
  weekStart: Date,
  now: Date,
): WeekData {
  const todayKey = ymd(now);

  // Seed all seven days so columns are always present, even when empty.
  const days: SlotDay[] = [];
  const byKey = new Map<string, SlotDay>();
  for (let i = 0; i < 7; i++) {
    const date = addDays(weekStart, i);
    const dateKey = ymd(date);
    // Map the real weekday → Mon-indexed short label (the window is rolling, so
    // day 0 is not necessarily Monday).
    const jsDow = date.getDay(); // 0=Sun..6=Sat
    const day: SlotDay = {
      dateKey,
      dateLabel: capitalize(RU_FULL_DAY.format(date)),
      dowShort: DOW_SHORT[jsDow === 0 ? 6 : jsDow - 1],
      dayNum: date.getDate(),
      isToday: dateKey === todayKey,
      slots: [],
      counts: emptyCounts(),
    };
    days.push(day);
    byKey.set(dateKey, day);
  }

  const counts = emptyCounts();
  let minStart = Infinity;
  let maxEnd = -Infinity;

  for (const s of slots) {
    const day = byKey.get(ymd(s.startsAt));
    if (!day) continue; // defensive — slot outside the window
    const status = statusOf(s);
    const startMin = minutesOf(s.startsAt);
    const endMin = minutesOf(s.endsAt);

    const appt =
      status === "booked" && s.appointment
        ? {
            id: s.appointment.id,
            statusLabel:
              ru.admin.statusLabels.appointment[
                s.appointment
                  .status as keyof typeof ru.admin.statusLabels.appointment
              ] ?? s.appointment.status,
            customer: s.appointment.user.name,
            service: s.appointment.service?.name ?? null,
          }
        : undefined;

    day.slots.push({
      id: s.id,
      timeLabel: RU_TIME.format(s.startsAt),
      rangeLabel: `${RU_TIME.format(s.startsAt)}–${RU_TIME.format(s.endsAt)}`,
      startMin,
      endMin,
      status,
      appointment: appt,
    });

    day.counts.all += 1;
    day.counts[status] += 1;
    counts.all += 1;
    counts[status] += 1;

    if (startMin < minStart) minStart = startMin;
    if (endMin > maxEnd) maxEnd = endMin;
  }

  // Hour-snapped axis, clamped to a sane default range when the week is empty
  // or tightly packed. `endMin` of an overnight slot can exceed 24h via the
  // next-day rollover; the clamp keeps the grid bounded.
  const axisStart =
    minStart === Infinity
      ? AXIS_DEFAULT_START
      : Math.min(AXIS_DEFAULT_START, Math.floor(minStart / 60) * 60);
  const axisEnd =
    maxEnd === -Infinity
      ? AXIS_DEFAULT_END
      : Math.max(AXIS_DEFAULT_END, Math.ceil(maxEnd / 60) * 60);

  const end = addDays(weekStart, 6);
  const sameMonth = weekStart.getMonth() === end.getMonth();
  const rangeLabel = sameMonth
    ? `${weekStart.getDate()}–${RU_DAY_MONTH.format(end)}`
    : `${RU_DAY_MONTH.format(weekStart)} – ${RU_DAY_MONTH.format(end)}`;

  return {
    weekStartKey: ymd(weekStart),
    prevWeekKey: ymd(addDays(weekStart, -7)),
    nextWeekKey: ymd(addDays(weekStart, 7)),
    prevDayKey: ymd(addDays(weekStart, -1)),
    nextDayKey: ymd(addDays(weekStart, 1)),
    todayKey,
    rangeLabel,
    days,
    counts,
    axis: { startMin: axisStart, endMin: axisEnd },
  };
}
