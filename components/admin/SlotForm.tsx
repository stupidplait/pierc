"use client";

import { useActionState } from "react";
import { createSlot, type SlotActionState } from "@/lib/admin/slot-actions";
import {
  TextField,
  CheckboxField,
  FormStatus,
  PrimarySubmit,
} from "@/components/admin/FormFields";
import { ru } from "@/lib/i18n/ru";

export function SlotForm() {
  const [state, action, pending] = useActionState<SlotActionState, FormData>(
    createSlot,
    undefined,
  );
  const t = ru.admin.slots;

  return (
    <form action={action} className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-3">
        <TextField name="date" label={t.dateLabel} type="date" required />
        <TextField name="start" label={t.startLabel} type="time" required />
        <TextField name="end" label={t.endLabel} type="time" required />
      </div>
      <CheckboxField name="isOpen" label={t.isOpenLabel} defaultChecked />
      <p className="text-xs text-mute">{t.timezoneNote}</p>
      <FormStatus state={state} />
      <div>
        <PrimarySubmit pending={pending}>
          {pending ? "…" : t.add}
        </PrimarySubmit>
      </div>
    </form>
  );
}
