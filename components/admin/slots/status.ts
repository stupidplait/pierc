// Shared slot-status vocabulary — one source of truth for the chip surface, the
// popover badge, and the schedule filter strip so colours/labels never drift.
// Plain (non-"use client") module so the server page can derive the status too.

import { ru } from "@/lib/i18n/ru";

export type SlotStatus = "free" | "booked" | "closed";

// The token palette already used by the old slots pills — reused verbatim so the
// redesign keeps the same status colours studio operators are used to.
//
// `chip`  — filled time-chip surface (the schedule grid).
// `badge` — outline pill (the popover header).
export const SLOT_STATUS_STYLES: Record<
  SlotStatus,
  { chip: string; badge: string; dot: string }
> = {
  free: {
    chip: "border-success/30 bg-success-soft text-success hover:border-success/60",
    badge: "border-success/30 bg-success-soft text-success",
    dot: "bg-success",
  },
  booked: {
    chip: "border-primary/40 bg-primary/10 text-primary hover:border-primary/60",
    badge: "border-primary/40 bg-primary/10 text-primary",
    dot: "bg-primary",
  },
  closed: {
    chip: "border-mute/40 bg-card text-mute hover:border-mute/60",
    badge: "border-mute/40 bg-card text-mute",
    dot: "bg-mute",
  },
};

export function slotStatusLabel(status: SlotStatus): string {
  return ru.admin.slots.list[status];
}
