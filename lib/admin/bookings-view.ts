// Shared bookings view-model — the row shape, day grouping, and formatters the
// bookings console consumes. Bookings are grouped by *creation* day (newest
// first), so the buckets read Сегодня / Вчера / older dates. Plain module so the
// server page and the console (a server component) import it directly.

import { ru } from "@/lib/i18n/ru";

export const BOOKING_STATUSES = [
  "RESERVED",
  "CONFIRMED",
  "FULFILLED",
  "CANCELLED",
] as const;
export type BookingStatus = (typeof BOOKING_STATUSES)[number];

/** Presentation-ready row for the console rail. Money/contact are pre-formatted
 *  (they need lib helpers); `createdAt` stays a Date for day grouping. */
export interface BookingItem {
  id: string;
  status: BookingStatus;
  jewelryName: string;
  material: string;
  price: string;
  clientName: string;
  /** "email · телефон", already joined. */
  clientContact: string;
  createdAt: Date;
}

const RU_DAY = new Intl.DateTimeFormat("ru-RU", {
  day: "numeric",
  month: "long",
});

export interface BookingDayGroup {
  key: string;
  label: string;
  items: BookingItem[];
}

function dayKeyOf(d: Date): string {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

function titleCase(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/**
 * Group bookings by creation day, preserving the incoming newest-first order.
 * Today / yesterday get friendly labels; older days show "29 мая".
 */
export function groupBookingsByDay(
  items: BookingItem[],
  todayStart: Date,
  yesterdayStart: Date,
): BookingDayGroup[] {
  const t = ru.admin.bookings;
  const groups: BookingDayGroup[] = [];
  const index = new Map<string, number>();

  for (const b of items) {
    const ds = new Date(b.createdAt);
    ds.setHours(0, 0, 0, 0);
    const key = dayKeyOf(ds);
    let i = index.get(key);
    if (i === undefined) {
      const label =
        ds.getTime() === todayStart.getTime()
          ? t.today
          : ds.getTime() === yesterdayStart.getTime()
            ? t.yesterday
            : titleCase(RU_DAY.format(b.createdAt));
      i = groups.length;
      index.set(key, i);
      groups.push({ key, label, items: [] });
    }
    groups[i].items.push(b);
  }
  return groups;
}
