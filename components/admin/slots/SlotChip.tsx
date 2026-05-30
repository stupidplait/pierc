"use client";

import { useState, useTransition } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/shadcn/ui/popover";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { deleteSlot, toggleSlotOpen } from "@/lib/admin/slot-actions";
import { ru } from "@/lib/i18n/ru";
import { cn } from "@/lib/utils";
import { SLOT_STATUS_STYLES, slotStatusLabel, type SlotStatus } from "./status";

// Pre-formatted, serializable shape the server page hands down — every label is
// built server-side so this stays a pure presentation layer (mirrors JewelryRow).
export interface SlotRow {
  id: string;
  /** Start time only, for the chip face — e.g. "11:00". */
  timeLabel: string;
  /** Full range, for the popover header — e.g. "11:00–12:00". */
  rangeLabel: string;
  status: SlotStatus;
}

// Popover action row — full-width ghost button matching the form kit vocabulary.
const ACTION =
  "flex h-10 w-full items-center rounded-lg px-3 text-sm font-medium text-mute transition-colors hover:bg-ink/5 hover:text-ink";
const ACTION_DELETE =
  "flex h-10 w-full items-center rounded-lg px-3 text-sm font-medium text-mute transition-colors hover:bg-error/10 hover:text-error";

/**
 * One slot rendered as a status-coloured time chip that opens a popover with its
 * range, status badge, and (for unbooked slots) Open/Close + Delete actions.
 *
 * The Open/Close toggle is a plain `<form>` posting to `toggleSlotOpen`. Delete
 * routes through the shared `ConfirmDialog`, which is rendered at the chip root
 * (not inside the popover) and fires `deleteSlot` in a transition — so it stays
 * robust even though opening the modal dismisses the Radix popover.
 */
export function SlotChip({ slot }: { slot: SlotRow }) {
  const [open, setOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const t = ru.admin.slots;
  const styles = SLOT_STATUS_STYLES[slot.status];

  const onDelete = () => {
    startTransition(async () => {
      const fd = new FormData();
      fd.set("id", slot.id);
      await deleteSlot(fd);
      setConfirmOpen(false);
    });
  };

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          className={cn(
            "inline-flex h-9 items-center rounded-lg border px-3 text-sm font-medium tabular-nums outline-none transition-colors focus-visible:ring-2 focus-visible:ring-accent/40 active:scale-[0.98]",
            styles.chip,
          )}
        >
          {slot.timeLabel}
        </PopoverTrigger>

        <PopoverContent align="start" className="w-56 p-2">
          <div className="flex items-center justify-between gap-3 px-1.5 pb-2 pt-1">
            <span className="text-sm font-medium tabular-nums text-ink">
              {slot.rangeLabel}
            </span>
            <span
              className={cn(
                "inline-flex w-fit shrink-0 items-center rounded-full border px-2 py-0.5 text-xs font-medium",
                styles.badge,
              )}
            >
              {slotStatusLabel(slot.status)}
            </span>
          </div>

          {slot.status === "booked" ? (
            <p className="border-t border-line/70 px-1.5 pb-1 pt-2 text-xs text-mute">
              {t.cantDelete}
            </p>
          ) : (
            <div className="flex flex-col border-t border-line/70 pt-1">
              <form>
                <input type="hidden" name="id" value={slot.id} />
                <button type="submit" formAction={toggleSlotOpen} className={ACTION}>
                  {slot.status === "free" ? t.toggleClose : t.toggleOpen}
                </button>
              </form>
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  setConfirmOpen(true);
                }}
                className={ACTION_DELETE}
              >
                {t.delete}
              </button>
            </div>
          )}
        </PopoverContent>
      </Popover>

      <ConfirmDialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={onDelete}
        title={t.confirmDelete}
        confirmLabel={t.delete}
        cancelLabel={ru.admin.common.cancel}
        pending={pending}
        tone="danger"
      />
    </>
  );
}
