// Shared appointments view-model — one source of truth for the row shape, day
// grouping, and the date/time formatters the four list views (agenda / console /
// board / rows) render. Plain (non-"use client") module so the server page and
// every server-rendered view can import it directly.

import { ru } from "@/lib/i18n/ru";

export const APPT_STATUSES = [
  "PENDING",
  "CONFIRMED",
  "COMPLETED",
  "CANCELLED",
  "NO_SHOW",
] as const;
export type ApptStatus = (typeof APPT_STATUSES)[number];

/**
 * The flattened, presentation-ready row every view consumes. The server page
 * maps the Prisma payload into this once so the views stay pure formatting —
 * dates stay as `Date` because views are server components (no client boundary).
 */
export interface ApptItem {
  id: string;
  status: ApptStatus;
  userName: string;
  userEmail: string;
  userPhone: string | null;
  serviceName: string | null;
  durationMin: number | null;
  startsAt: Date | null;
  endsAt: Date | null;
  bookingsCount: number;
}

export const RU_TIME = new Intl.DateTimeFormat("ru-RU", {
  hour: "2-digit",
  minute: "2-digit",
});
const RU_DAY = new Intl.DateTimeFormat("ru-RU", {
  weekday: "long",
  day: "numeric",
  month: "long",
});

export function fmtTime(d: Date | null): string {
  return d ? RU_TIME.format(d) : "—";
}

export interface DayGroup {
  key: string;
  label: string;
  /** Anchor date of the day (null for the "no slot" bucket). */
  date: Date | null;
  isToday: boolean;
  items: ApptItem[];
}

function dayKeyOf(d: Date): string {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

function titleCase(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/**
 * Group items by calendar day (slot start), preserving the incoming order — the
 * list query already sorts by slot ascending, so the first day surfaces first.
 * "Today" / "Tomorrow" get friendly labels; the slot-less bucket sinks to its
 * own group.
 */
export function groupByDay(
  items: ApptItem[],
  todayStart: Date,
  tomorrowStart: Date,
): DayGroup[] {
  const L = ru.admin.appointments.list;
  const map = new Map<string, ApptItem[]>();
  for (const a of items) {
    const key = a.startsAt ? dayKeyOf(a.startsAt) : "__noslot__";
    const arr = map.get(key);
    if (arr) arr.push(a);
    else map.set(key, [a]);
  }

  const out: DayGroup[] = [];
  for (const [key, arr] of map) {
    if (key === "__noslot__") {
      out.push({
        key,
        label: ru.admin.appointments.noSlot,
        date: null,
        isToday: false,
        items: arr,
      });
      continue;
    }
    const d = arr[0].startsAt!;
    const ds = new Date(d);
    ds.setHours(0, 0, 0, 0);
    const isToday = ds.getTime() === todayStart.getTime();
    const label = isToday
      ? L.today
      : ds.getTime() === tomorrowStart.getTime()
        ? L.tomorrow
        : titleCase(RU_DAY.format(d));
    out.push({ key, label, date: d, isToday, items: arr });
  }
  return out;
}
