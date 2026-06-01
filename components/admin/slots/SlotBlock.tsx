"use client";

import { cn } from "@/lib/utils";
import type { SlotRow } from "@/lib/admin/slots-view";
import { SLOT_STATUS_STYLES } from "./status";
import { SlotPopover } from "./SlotPopover";

/**
 * Time-axis cousin of `SlotChip`: a height-proportional block placed in a day
 * column by `CalendarGrid`. Content is centred; taller booked windows also show
 * the customer.
 */
export function SlotBlock({
  slot,
  top,
  height,
}: {
  slot: SlotRow;
  top: number;
  height: number;
}) {
  const styles = SLOT_STATUS_STYLES[slot.status];
  const h = Math.max(height - 2, 20);
  const tiny = h < 40;
  return (
    <div
      className="absolute inset-x-1"
      style={{ top, height: h }}
      // Keep a block click from reaching the column's click-to-create handler.
      onClick={(e) => e.stopPropagation()}
    >
      <SlotPopover slot={slot} align="center">
        <button
          type="button"
          className={cn(
            "flex h-full w-full flex-col items-center justify-center gap-0.5 overflow-hidden rounded-lg border px-1.5 text-center leading-tight outline-none transition-colors focus-visible:ring-2 focus-visible:ring-accent/40",
            styles.chip,
          )}
        >
          <span className="text-[13px] font-medium tabular-nums">
            {tiny ? slot.timeLabel : slot.rangeLabel}
          </span>
          {!tiny && slot.appointment ? (
            <span className="max-w-full truncate text-[11px] opacity-80">
              {slot.appointment.customer}
            </span>
          ) : null}
        </button>
      </SlotPopover>
    </div>
  );
}
