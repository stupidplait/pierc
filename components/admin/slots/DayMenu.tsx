"use client";

import { useMemo, useState, useTransition } from "react";
import { MoreHorizontal, Plus } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/shadcn/ui/popover";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { bulkUpdateSlots } from "@/lib/admin/slot-actions";
import { ru } from "@/lib/i18n/ru";
import type { SlotDay } from "@/lib/admin/slots-view";
import { useSlots } from "./context";

const ITEM =
  "flex h-9 w-full items-center gap-2 rounded-lg px-3 text-sm font-medium text-mute transition-colors hover:bg-ink/5 hover:text-ink disabled:pointer-events-none disabled:opacity-40";
const ITEM_DELETE =
  "flex h-9 w-full items-center gap-2 rounded-lg px-3 text-sm font-medium text-mute transition-colors hover:bg-error/10 hover:text-error disabled:pointer-events-none disabled:opacity-40";

/** The per-day "⋯" menu: bulk open / close / delete-free + quick-add. */
export function DayMenu({ day }: { day: SlotDay }) {
  const t = ru.admin.slots.manager;
  const { requestQuickAdd } = useSlots();
  const [open, setOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  // Partition the day's slots by what each action can act on.
  const ids = useMemo(() => {
    const closed: string[] = [];
    const free: string[] = [];
    const removable: string[] = []; // anything not booked
    for (const s of day.slots) {
      if (s.status === "closed") closed.push(s.id);
      if (s.status === "free") free.push(s.id);
      if (s.status !== "booked") removable.push(s.id);
    }
    return { closed, free, removable };
  }, [day.slots]);

  const run = (slotIds: string[], op: "open" | "close" | "delete") => {
    if (slotIds.length === 0) return;
    startTransition(async () => {
      await bulkUpdateSlots(slotIds, op);
      setOpen(false);
      setConfirmOpen(false);
    });
  };

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          className="flex size-7 items-center justify-center rounded-lg text-mute outline-none transition-colors hover:bg-ink/5 hover:text-ink focus-visible:ring-2 focus-visible:ring-accent/40"
          aria-label={t.dayActions}
        >
          <MoreHorizontal className="size-4" />
        </PopoverTrigger>

        <PopoverContent align="end" className="w-52 p-1.5">
          <button
            type="button"
            className={ITEM}
            onClick={() => {
              setOpen(false);
              requestQuickAdd(day.dateKey);
            }}
          >
            <Plus className="size-4" />
            {t.addHere}
          </button>

          <div className="my-1 border-t border-line/70" />

          <button
            type="button"
            className={ITEM}
            disabled={pending || ids.closed.length === 0}
            onClick={() => run(ids.closed, "open")}
          >
            {t.openDay}
          </button>
          <button
            type="button"
            className={ITEM}
            disabled={pending || ids.free.length === 0}
            onClick={() => run(ids.free, "close")}
          >
            {t.closeDay}
          </button>
          <button
            type="button"
            className={ITEM_DELETE}
            disabled={pending || ids.removable.length === 0}
            onClick={() => {
              setOpen(false);
              setConfirmOpen(true);
            }}
          >
            {t.deleteFree}
          </button>
        </PopoverContent>
      </Popover>

      <ConfirmDialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={() => run(ids.removable, "delete")}
        title={t.confirmDeleteFree}
        confirmLabel={ru.admin.slots.delete}
        cancelLabel={ru.admin.common.cancel}
        pending={pending}
        tone="danger"
      />
    </>
  );
}
