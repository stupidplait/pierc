"use client";

import { type ReactNode, useState, useTransition } from "react";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/shadcn/ui/popover";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { deleteSlot, toggleSlotOpen } from "@/lib/admin/slot-actions";
import { ru } from "@/lib/i18n/ru";
import type { SlotRow } from "@/lib/admin/slots-view";

// Popover action row — full-width ghost button matching the form-kit vocabulary.
const ACTION =
  "flex h-10 w-full items-center rounded-lg px-3 text-sm font-medium text-mute transition-colors hover:bg-ink/5 hover:text-ink";
const ACTION_DELETE =
  "flex h-10 w-full items-center rounded-lg px-3 text-sm font-medium text-mute transition-colors hover:bg-error/10 hover:text-error";

/**
 * Shared slot detail popover for `SlotChip` (board/list) and `SlotBlock`
 * (calendar). `children` is the trigger surface. For a booked window it shows
 * the booking (customer · service · status) with a link to the appointment;
 * for a free/closed window it offers the one-click open/close + delete.
 */
export function SlotPopover({
  slot,
  children,
  align = "start",
}: {
  slot: SlotRow;
  children: ReactNode;
  align?: "start" | "center" | "end";
}) {
  const [open, setOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const t = ru.admin.slots;

  const onDelete = () => {
    startTransition(async () => {
      const fd = new FormData();
      fd.set("id", slot.id);
      await deleteSlot(fd);
      setConfirmOpen(false);
    });
  };

  const booked = slot.status === "booked";

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>{children}</PopoverTrigger>

        <PopoverContent align={align} className="w-60 p-2">
          <div className="px-1.5 pb-2 pt-1">
            <span className="text-sm font-medium tabular-nums text-ink">
              {slot.rangeLabel}
            </span>
          </div>

          {booked ? (
            <div className="border-t border-line/70 px-1.5 pb-1 pt-2">
              {slot.appointment ? (
                <>
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-sm font-medium text-ink">
                      {slot.appointment.customer}
                    </p>
                    <span className="shrink-0 rounded-full border border-primary/40 bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
                      {slot.appointment.statusLabel}
                    </span>
                  </div>
                  {slot.appointment.service ? (
                    <p className="mt-0.5 truncate text-xs text-mute">
                      {slot.appointment.service}
                    </p>
                  ) : null}
                  <Link
                    href={`/admin/appointments/${slot.appointment.id}`}
                    className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-accent hover:underline"
                  >
                    Открыть запись
                    <ArrowUpRight className="size-3.5" />
                  </Link>
                </>
              ) : null}
            </div>
          ) : (
            <div className="flex flex-col border-t border-line/70 pt-1">
              <form>
                <input type="hidden" name="id" value={slot.id} />
                <button
                  type="submit"
                  formAction={toggleSlotOpen}
                  className={ACTION}
                >
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
