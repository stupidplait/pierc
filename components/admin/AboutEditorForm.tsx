"use client";

import { useActionState } from "react";
import {
  TextAreaField,
  FormStatus,
  PrimarySubmit,
} from "@/components/admin/FormFields";
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

  return (
    <form action={action} className="flex flex-col gap-5">
      <TextAreaField
        name="body"
        label={ru.admin.content.about.bodyLabel}
        defaultValue={initialBody}
        required
        rows={10}
      />
      <FormStatus state={state} />
      <div>
        <PrimarySubmit pending={pending}>
          {pending ? "…" : ru.admin.content.about.save}
        </PrimarySubmit>
      </div>
    </form>
  );
}
