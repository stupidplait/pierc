// Appointment status tones for the *views* (timeline node dots, row accent
// edges, board column markers). Distinct purpose from StatusBadges, which names
// the literal status — here colour signals operator intent at a glance:
//
//   PENDING   → accent (magenta): needs your confirmation — the one magenta
//               moment, pulls the eye to what's actionable.
//   CONFIRMED → ink: locked in, upcoming.
//   COMPLETED → success (green): done.
//   NO_SHOW   → warn (amber): something went wrong.
//   CANCELLED → mute: voided, recedes.
//
// Plain module (no "use client") so server-rendered views import it directly.

import type { ApptStatus } from "@/lib/admin/appointments-view";

export interface ApptTone {
  /** Filled node dot / strong marker background. */
  dot: string;
  /** Left accent edge bar background. */
  edge: string;
  /** Accent text colour. */
  text: string;
  /** Soft surface wash (board column header, hover). */
  soft: string;
}

export const APPT_TONE: Record<ApptStatus, ApptTone> = {
  PENDING: {
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
  COMPLETED: {
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
  NO_SHOW: {
    dot: "bg-warn",
    edge: "bg-warn/70",
    text: "text-warn",
    soft: "bg-warn-soft",
  },
};
