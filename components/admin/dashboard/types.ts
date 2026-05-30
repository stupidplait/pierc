// Shared shape for the admin-dashboard Status Board. The server page builds
// these from live Prisma counts.
export type MetricTone = "primary" | "warn" | "neutral";

export interface Metric {
  key: string;
  href: string;
  /** Full title (used where space allows). */
  title: string;
  /** Compact label for the activity-feed rows. */
  titleShort: string;
  lead: string;
  count: number;
  tone: MetricTone;
  /** count > 0 on an actionable tone — drives the accent ping / warn glyph. */
  urgent: boolean;
}

export interface QuickAction {
  href: string;
  label: string;
  /** Glyph key for ActionIcon — set explicitly so it doesn't depend on the
      href tail (e.g. /admin/jewelry/new tails to "new", not "jewelry"). */
  kind: string;
}
