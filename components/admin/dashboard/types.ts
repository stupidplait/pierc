// Shared shapes for the admin dashboard. The server page builds these from live
// Prisma data. `MetricTone` is reused by the v2 metric cards (see v2/types.ts).
export type MetricTone = "primary" | "warn" | "neutral";

export interface QuickAction {
  /** Navigation target. Omitted for action-driven items (use `action`). */
  href?: string;
  /** Server action for POST-style quick actions (e.g. "create draft" — a
      mutation, so it can't be a prefetched GET link). Takes precedence over href. */
  action?: () => Promise<void>;
  label: string;
  /** Glyph key for ActionIcon — set explicitly so it doesn't depend on the
      href tail (e.g. /admin/jewelry/new tails to "new", not "jewelry"). */
  kind: string;
}
