"use client";

import { useActionState } from "react";
import { createSlot, type SlotActionState } from "@/lib/admin/slot-actions";
import {
  Field,
  InlineStatus,
  Reveal,
  SubmitPill,
  Toggle,
} from "@/components/admin/form/atelier";
import { CARD } from "@/components/admin/form/styles";
import { ru } from "@/lib/i18n/ru";

export function SlotForm({ delay = 0 }: { delay?: number }) {
  const [state, action, pending] = useActionState<SlotActionState, FormData>(
    createSlot,
    undefined,
  );
  const t = ru.admin.slots;

  return (
    <Reveal delay={delay}>
      <details className={`${CARD} group p-6 sm:p-7`}>
        <summary className="flex cursor-pointer list-none items-center justify-between gap-4">
          <div>
            <h2 className="font-display text-xl font-medium tracking-tight text-ink">
              {t.singleHeading}
            </h2>
            <p className="mt-1 text-sm text-mute">{t.singleLead}</p>
          </div>
          <span
            aria-hidden
            className="grid size-8 shrink-0 place-items-center rounded-lg border border-ink/15 text-mute transition-transform duration-200 group-open:rotate-180"
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
              <path
                d="M4 6l4 4 4-4"
                stroke="currentColor"
                strokeWidth="1.4"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>
        </summary>

        <form action={action} className="mt-6 flex flex-col gap-5">
          <div className="grid gap-4 sm:grid-cols-3">
            <Field name="date" label={t.dateLabel} type="date" required />
            <Field name="start" label={t.startLabel} type="time" required />
            <Field name="end" label={t.endLabel} type="time" required />
          </div>

          <div className="flex">
            <Toggle name="isOpen" label={t.isOpenLabel} defaultChecked />
          </div>

          <div className="flex flex-wrap items-center gap-4">
            <SubmitPill pending={pending}>{pending ? "…" : t.add}</SubmitPill>
            <InlineStatus state={state} />
          </div>

          <p className="text-xs text-mute">{t.timezoneNote}</p>
        </form>
      </details>
    </Reveal>
  );
}
