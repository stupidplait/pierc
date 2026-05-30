"use client";

import { useActionState } from "react";
import { Plus } from "lucide-react";
import { createSlot, type SlotActionState } from "@/lib/admin/slot-actions";
import { Button } from "@/components/shadcn/ui/button";
import { Input } from "@/components/shadcn/ui/input";
import { Switch } from "@/components/shadcn/ui/switch";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/shadcn/ui/popover";
import { InlineStatus, SubmitPill } from "@/components/admin/form/atelier";
import { LABEL } from "@/components/admin/form/styles";
import { ru } from "@/lib/i18n/ru";

/**
 * Single-slot creator tucked into a header popover — the rare one-off path, kept
 * out of the way of the bulk planner + schedule. Same `createSlot` server action
 * + `useActionState` the old inline `<details>` form used; the Switch posts
 * `isOpen=on` which the action's `v === "on"` preprocess expects.
 */
export function SingleSlotPopover() {
  const [state, action, pending] = useActionState<SlotActionState, FormData>(
    createSlot,
    undefined,
  );
  const t = ru.admin.slots;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" className="gap-2 px-4">
          <Plus className="size-4" />
          {t.addSingle}
        </Button>
      </PopoverTrigger>

      <PopoverContent align="end" className="w-80 p-4">
        <div className="pb-3">
          <h3 className="font-display text-base font-medium tracking-tight text-ink">
            {t.singleHeading}
          </h3>
          <p className="mt-0.5 text-xs text-mute">{t.singleLead}</p>
        </div>

        <form action={action} className="flex flex-col gap-4">
          <label className="flex flex-col gap-1.5">
            <span className={LABEL}>{t.dateLabel}</span>
            <Input type="date" name="date" required />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1.5">
              <span className={LABEL}>{t.startLabel}</span>
              <Input type="time" name="start" required />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className={LABEL}>{t.endLabel}</span>
              <Input type="time" name="end" required />
            </label>
          </div>

          <label
            htmlFor="single-isOpen"
            className="flex items-center justify-between gap-3"
          >
            <span className="text-sm text-ink">{t.isOpenLabel}</span>
            <Switch id="single-isOpen" name="isOpen" defaultChecked />
          </label>

          <div className="flex flex-wrap items-center gap-3">
            <SubmitPill pending={pending}>{pending ? "…" : t.add}</SubmitPill>
            <InlineStatus state={state} />
          </div>

          <p className="text-xs text-mute">{t.timezoneNote}</p>
        </form>
      </PopoverContent>
    </Popover>
  );
}
