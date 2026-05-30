"use client";

import { useActionState } from "react";
import {
  CardHeader,
  InlineStatus,
  Reveal,
  SubmitPill,
  TextArea,
} from "@/components/admin/form/atelier";
import { CARD } from "@/components/admin/form/styles";
import {
  updateAbout,
  type ActionState,
} from "@/lib/admin/content-actions";
import { ru } from "@/lib/i18n/ru";

interface AboutEditorFormProps {
  initialBody: string;
}

export function AboutEditorForm({ initialBody }: AboutEditorFormProps) {
  const [state, action, pending] = useActionState<ActionState, FormData>(
    updateAbout,
    undefined,
  );
  const t = ru.admin.content.about;

  return (
    <Reveal>
      <form
        action={action}
        className={`${CARD} flex flex-col gap-6 p-7 sm:p-9`}
      >
        <CardHeader title={t.title} lead={t.lead} />
        <TextArea
          name="body"
          label={t.bodyLabel}
          defaultValue={initialBody}
          required
          rows={12}
          placeholder={t.bodyPlaceholder}
        />
        <div className="flex flex-wrap items-center gap-4">
          <SubmitPill pending={pending}>
            {pending ? "…" : t.save}
          </SubmitPill>
          <InlineStatus state={state} />
        </div>
      </form>
    </Reveal>
  );
}
