"use client";

import { useActionState } from "react";
import {
  TextField,
  TextAreaField,
  NumberField,
  CheckboxField,
  FormStatus,
  PrimarySubmit,
} from "@/components/admin/FormFields";
import { ConfirmDeleteButton } from "@/components/admin/ConfirmDeleteButton";
import {
  upsertFaq,
  deleteFaq,
  type ActionState,
} from "@/lib/admin/content-actions";
import { ru } from "@/lib/i18n/ru";

interface FaqLike {
  id?: string;
  question?: string;
  answer?: string;
  order?: number | null;
  published?: boolean;
}

interface FaqFormProps {
  initial?: FaqLike;
  isNew?: boolean;
}

export function FaqForm({ initial, isNew = false }: FaqFormProps) {
  const [state, action, pending] = useActionState<ActionState, FormData>(
    upsertFaq,
    undefined,
  );
  const t = ru.admin.content.faq;

  return (
    <form
      action={action}
      className={`grid gap-4 rounded-2xl border border-line p-5 sm:grid-cols-2 ${
        isNew ? "bg-card/40" : "bg-page"
      }`}
    >
      {initial?.id ? <input type="hidden" name="id" value={initial.id} /> : null}

      <div className="sm:col-span-2">
        <TextField
          name="question"
          label={t.questionLabel}
          required
          defaultValue={initial?.question ?? ""}
        />
      </div>

      <div className="sm:col-span-2">
        <TextAreaField
          name="answer"
          label={t.answerLabel}
          required
          defaultValue={initial?.answer ?? ""}
          rows={4}
        />
      </div>

      <NumberField
        name="order"
        label={t.orderLabel}
        defaultValue={initial?.order ?? 0}
      />

      <CheckboxField
        name="published"
        label={t.publishedLabel}
        defaultChecked={initial?.published ?? true}
      />

      <div className="sm:col-span-2 space-y-3">
        <FormStatus state={state} />
        <div className="flex items-center gap-3">
          <PrimarySubmit pending={pending}>
            {pending ? "…" : isNew ? t.add : t.save}
          </PrimarySubmit>
          {initial?.id ? (
            <ConfirmDeleteButton
              formAction={deleteFaq}
              confirmText={t.confirmDelete}
            >
              {t.delete}
            </ConfirmDeleteButton>
          ) : null}
        </div>
      </div>
    </form>
  );
}
