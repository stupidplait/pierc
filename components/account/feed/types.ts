import type { AppointmentStatus, JewelryBookingStatus } from "@prisma/client";

// ─── Shared serializable shapes (mirror the loader in app/(public)/account) ──

export interface Piece {
  id: string;
  name: string;
  price: string;
  status: JewelryBookingStatus;
  canCancel: boolean;
}

export interface AppointmentEntry {
  id: string;
  slotLabel: string | null;
  serviceName: string | null;
  shortDate: string;
  sortMs: number;
  startsAtMs: number | null;
  status: AppointmentStatus;
  canCancel: boolean;
  pieces: Piece[];
}

export interface StandaloneBooking {
  id: string;
  name: string;
  price: string;
  shortDate: string;
  sortMs: number;
  status: JewelryBookingStatus;
  canCancel: boolean;
}

export interface NextAppointment {
  id: string;
  countdownLabel: string;
}

// A single feed row — either an appointment (with nested pieces) or a
// standalone jewelry reservation. Tagged union so renderers stay exhaustive.
export type FeedItem =
  | { kind: "appt"; sortMs: number; appt: AppointmentEntry }
  | { kind: "booking"; sortMs: number; booking: StandaloneBooking };

// Props every feed variant receives. The variant owns layout/grouping; the
// shared row parts (AppointmentAccordion, StandaloneBookingRow) render content.
export interface FeedVariantProps {
  /** All rows except the pinned next appointment, newest-first. */
  feed: FeedItem[];
  /** The soonest upcoming appointment, surfaced as a head/hero node. */
  nextEntry: AppointmentEntry | null;
  nextCountdownLabel?: string;
  total: number;
}

export function itemKey(item: FeedItem): string {
  return item.kind === "appt" ? `a-${item.appt.id}` : `b-${item.booking.id}`;
}
