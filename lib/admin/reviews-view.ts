// Shared reviews view-model — one source of truth for the row shape and the
// per-status tones the moderation wall renders. Plain module (no "use client")
// so the server page and the server-rendered wall import it directly, mirroring
// lib/admin/appointments-view.

import { ru } from "@/lib/i18n/ru";

export const REVIEW_STATUSES = ["PENDING", "PUBLISHED", "REJECTED"] as const;
export type ReviewStatus = (typeof REVIEW_STATUSES)[number];

/**
 * The flattened, presentation-ready row every view consumes. The server page
 * maps the Prisma payload into this once (date pre-formatted, jewelry flattened
 * to names) so the views stay pure formatting.
 */
export interface ReviewItem {
  id: string;
  rating: number;
  text: string;
  authorName: string;
  status: ReviewStatus;
  featured: boolean;
  /** Tied to a real appointment → "проверенный клиент". */
  verified: boolean;
  jewelry: string[];
  /** Pre-formatted RU date — the server owns formatting so views stay Date-free. */
  createdAt: string;
}

export interface ReviewCounts {
  all: number;
  PENDING: number;
  PUBLISHED: number;
  REJECTED: number;
}

/**
 * Per-status tones for the *views* (corner tags, column markers, card accents).
 * Distinct from StatusBadges (which names the literal status); here colour
 * signals operator intent at a glance, the same convention as APPT_TONE:
 *
 *   PENDING   → accent (magenta): needs moderation — the one actionable state.
 *   PUBLISHED → success (green): live on the site.
 *   REJECTED  → mute: hidden, recedes.
 */
export interface ReviewTone {
  dot: string;
  edge: string;
  text: string;
  soft: string;
  ring: string;
}

export const REVIEW_TONE: Record<ReviewStatus, ReviewTone> = {
  PENDING: {
    dot: "bg-accent",
    edge: "bg-accent",
    text: "text-accent",
    soft: "bg-accent/10",
    ring: "ring-accent/30",
  },
  PUBLISHED: {
    dot: "bg-success",
    edge: "bg-success/70",
    text: "text-success",
    soft: "bg-success-soft",
    ring: "ring-success/30",
  },
  REJECTED: {
    dot: "bg-mute/50",
    edge: "bg-mute/40",
    text: "text-mute",
    soft: "bg-card",
    ring: "ring-mute/20",
  },
};

export function reviewStatusLabel(status: ReviewStatus): string {
  return ru.admin.statusLabels.review[status];
}

/** Editor href for a review row — moderation actions live there. */
export function reviewEditHref(id: string): string {
  return `/admin/reviews/${id}/edit`;
}
