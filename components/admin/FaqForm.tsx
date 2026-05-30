"use client";

import { useActionState } from "react";
import {
  CardHeader,
  Field,
  InlineStatus,
  NumberField,
  Reveal,
  Select,
  SubmitPill,
  TextArea,
  Toggle,
} from "@/components/admin/form/atelier";
import { CARD, GHOST_DELETE } from "@/components/admin/form/styles";
import { ConfirmDeleteButton } from "@/components/admin/ConfirmDeleteButton";
import {
  upsertFaq,
  deleteFaq,
  type ActionState,
} from "@/lib/admin/content-actions";
import { FAQ_CATEGORIES } from "@/components/faq/faqData";
import { ru } from "@/lib/i18n/ru";

const CATEGORY_OPTIONS = FAQ_CATEGORIES.map((c) => ({
  value: c.key,
  label: c.label,
}));

interface FaqLike {
  id?: string;
  question?: string;
  answer?: string;
  category?: string | null;
  order?: number | null;
  published?: boolean;
}

interface FaqFormProps {
  initial?: FaqLike;
  isNew?: boolean;
  /** Stagger offset for the entrance, derived from the row index. */
  delay?: number;
}

export function FaqForm({ initial, isNew = false, delay = 0 }: FaqFormProps) {
  const [state, action, pending] = useActionState<ActionState, FormData>(
    upsertFaq,
    undefined,
  );
  const t = ru.admin.content.faq;

  return (
    <Reveal delay={delay}>
      <form
        action={action}
        className={`${CARD} grid gap-5 p-6 sm:grid-cols-2 sm:p-7 ${
          isNew ? "border-accent/25" : ""
        }`}
      >
        {initial?.id ? (
          <input type="hidden" name="id" value={initial.id} />
        ) : null}

        {isNew ? <CardHeader title={t.addHeading} /> : null}

        <Field
          name="question"
          label={t.questionLabel}
          required
          defaultValue={initial?.question ?? ""}
          placeholder={t.questionPlaceholder}
          full
        />

        <TextArea
          name="answer"
          label={t.answerLabel}
          required
          defaultValue={initial?.answer ?? ""}
          rows={4}
          placeholder={t.answerPlaceholder}
          full
        />

        <Select
          name="category"
          label={t.categoryLabel}
          defaultValue={initial?.category ?? ""}
          options={CATEGORY_OPTIONS}
          placeholder={t.categoryNone}
        />

        <NumberField
          name="order"
          label={t.orderLabel}
          defaultValue={initial?.order ?? 0}
        />

        <Toggle
          name="published"
          label={t.publishedLabel}
          defaultChecked={initial?.published ?? true}
        />

        <div className="flex flex-wrap items-center gap-4 sm:col-span-2">
          <SubmitPill pending={pending}>
            {pending ? "…" : isNew ? t.add : t.save}
          </SubmitPill>
          {initial?.id ? (
            <ConfirmDeleteButton
              formAction={deleteFaq}
              confirmText={t.confirmDelete}
              className={GHOST_DELETE}
            >
              {t.delete}
            </ConfirmDeleteButton>
          ) : null}
          <InlineStatus state={state} />
        </div>
      </form>
    </Reveal>
  );
}
