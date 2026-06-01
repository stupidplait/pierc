// Booking status tones for the console (rail dot, dossier accents). Distinct
// from StatusBadges (which names the literal status); here colour signals
// operator intent, mirroring the appointments tones:
//
//   RESERVED  → accent (magenta): needs your action — the one magenta moment.
//   CONFIRMED → ink: locked in.
//   FULFILLED → success (green): done.
//   CANCELLED → mute: voided, recedes.
//
// Note: the theme aliases --primary to --accent, so `text-primary` and
// `text-accent` are the same magenta — hence CONFIRMED uses ink (not primary)
// to stay visually distinct from RESERVED. Plain module (no "use client").

import type { BookingStatus } from "@/lib/admin/bookings-view";

export interface BookingTone {
  dot: string;
  edge: string;
  text: string;
  soft: string;
}

export const BOOKING_TONE: Record<BookingStatus, BookingTone> = {
  RESERVED: {
    dot: "bg-accent",
    edge: "bg-accent",
    text: "text-accent",
    soft: "bg-accent/10",
  },
  CONFIRMED: {
    dot: "bg-ink",
    edge: "bg-ink/60",
    text: "text-ink",
    soft: "bg-ink/5",
  },
  FULFILLED: {
    dot: "bg-success",
    edge: "bg-success/70",
    text: "text-success",
    soft: "bg-success-soft",
  },
  CANCELLED: {
    dot: "bg-mute/50",
    edge: "bg-mute/40",
    text: "text-mute",
    soft: "bg-card",
  },
};
